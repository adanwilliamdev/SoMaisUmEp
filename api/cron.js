const { db, rota, erro, igual } = require('./_lib');

const DIA = 864e5;

// Faxina e avisos diários (Vercel Cron, veja "crons" no vercel.json). A Vercel envia "Authorization: Bearer <CRON_SECRET>".
//  - avisos de episódios que saem hoje, por notificação push (_notificar.js);
//  - tentativas de login antigas e já desbloqueadas;
//  - links de redefinição de senha vencidos;
//  - capas do Blob que nenhum título usa mais (órfãs, com mais de 24 h para não pegar envio em andamento).
const apagados = async (sql, consulta) => (await consulta)[0].n;

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
      sql,
      sql`with d as (delete from tentativas where ate < ${agora} and ultima < ${agora - 2 * DIA} returning 1) select count(*)::int as n from d`,
    );
    const links = await apagados(sql, sql`with d as (delete from reset_senha where expira < ${agora} returning 1) select count(*)::int as n from d`);
    const capasBlob = await varrerCapas(sql);
    const capasRegistro = await apagados(
      sql,
      sql`with d as (delete from capas c where c.criado < ${agora - DIA} and not exists (select 1 from titulos t where t.capa = c.url) returning 1) select count(*)::int as n from d`,
    );
    // Avisos de lançamento por push (só se as chaves VAPID estiverem configuradas). Falha aqui não impede o resto da faxina.
    let push = { ativo: false };
    try {
      push = await require('./_notificar').enviarLancamentos(sql, { agora });
    } catch (e) {
      console.error('cron push:', e.message);
      push = { ativo: true, erro: true };
    }
    res.json({ ok: true, tentativas, links, capasBlob, capasRegistro, push });
  },
  true,
);
