const { db, rota, erro, igual } = require('./_lib');

const DIA = 864e5;

// Faxina e avisos diários (Vercel Cron, veja "crons" no vercel.json). A Vercel envia "Authorization: Bearer <CRON_SECRET>".
//  - próximo lançamento de cada título, consultado no TMDb pelo servidor (_atualizar.js), para os avisos não dependerem de o app ter sido aberto;
//  - avisos de episódios que saem hoje, por notificação push (_notificar.js), sempre DEPOIS da etapa anterior;
//  - tentativas de login antigas e já desbloqueadas;
//  - links de redefinição de senha vencidos;
//  - capas do Blob que nenhum título usa mais (órfãs, com mais de 24 h para não pegar envio em andamento).
const apagados = async consulta => (await consulta)[0].n;

async function varrerCapas(sql) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return 0;
  const { list, del } = require('@vercel/blob');
  const limite = Date.now() - DIA;
  let cursor,
    removidas = 0;
  for (let pag = 0; pag < 10; pag++) {
    // até 10 mil arquivos por execução
    const r = await list({ prefix: 'capas/', cursor, limit: 1000 });
    const velhas = r.blobs.filter(b => new Date(b.uploadedAt).getTime() < limite).map(b => b.url);
    for (let i = 0; i < velhas.length; i += 200) {
      const lote = velhas.slice(i, i + 200);
      const usadas = new Set((await sql`select capa from titulos where capa = any(${lote})`).map(x => x.capa));
      const lixo = lote.filter(u => !usadas.has(u));
      if (lixo.length) {
        await del(lixo);
        removidas += lixo.length;
      }
    }
    if (!r.hasMore) break;
    cursor = r.cursor;
  }
  return removidas;
}

module.exports = rota(
  'GET',
  async (req, res) => {
    const segredo = process.env.CRON_SECRET;
    if (!segredo) throw erro('CRON_SECRET não configurado.', 500);
    if (!igual(req.headers.authorization || '', 'Bearer ' + segredo)) return res.status(401).json({ erro: 'Não autorizado' });

    const sql = db(),
      agora = Date.now();
    const tentativas = await apagados(
      sql`with d as (delete from tentativas where ate < ${agora} and ultima < ${agora - 2 * DIA} returning 1) select count(*)::int as n from d`,
    );
    const links = await apagados(sql`with d as (delete from reset_senha where expira < ${agora} returning 1) select count(*)::int as n from d`);
    const capasRegistro = await apagados(
      sql`with d as (delete from capas c where c.criado < ${agora - DIA} and not exists (select 1 from titulos t where t.capa = c.url) returning 1) select count(*)::int as n from d`,
    );
    // 1) Datas de lançamento: consulta o TMDb (deduplicado entre contas, em lotes e com limite de tempo). Falha aqui não impede os avisos.
    let proximos = { ativo: false };
    try {
      proximos = await require('./_atualizar').atualizarProximos(sql, { agora });
    } catch (e) {
      console.error('cron proximos:', e.message);
      proximos = { ativo: true, erro: true };
    }
    // 2) Avisos de lançamento por push (só se as chaves VAPID estiverem configuradas). Falha aqui não impede o resto da faxina.
    let push = { ativo: false };
    try {
      push = await require('./_notificar').enviarLancamentos(sql, { agora });
    } catch (e) {
      console.error('cron push:', e.message);
      push = { ativo: true, erro: true };
    }
    // Por último, a etapa mais lenta (lista o Blob): se ela estourar o tempo, as datas e os avisos já foram feitos.
    const capasBlob = await varrerCapas(sql);
    res.json({ ok: true, tentativas, links, capasBlob, capasRegistro, proximos, push });
  },
  true,
);
