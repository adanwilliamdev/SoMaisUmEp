const { db, rota, erro, igual } = require('./_lib');
const { esc } = require('./_texto');

const DIA = 864e5;

// Faxina e avisos diários (Vercel Cron, veja "crons" no vercel.json). A Vercel envia "Authorization: Bearer <CRON_SECRET>".
//  - próximo lançamento de cada título, consultado no TMDb pelo servidor (_atualizar.js), para os avisos não dependerem de o app ter sido aberto;
//  - avisos de episódios que saem hoje, por notificação push (_notificar.js), sempre DEPOIS da etapa anterior;
//  - tentativas de login antigas e já desbloqueadas;
//  - links de redefinição de senha vencidos;
//  - capas do Blob que nenhum título usa mais (órfãs, com mais de 24 h para não pegar envio em andamento).
// Cada etapa que falha não derruba as outras, mas a execução termina com erro (HTTP 500 e `falhas` na resposta), para aparecer como falha nos
// logs da Vercel em vez de passar por sucesso. Com ALERTA_EMAIL (e o Resend configurado), também chega um e-mail; o cron roda uma vez por dia.
const apagados = async consulta => (await consulta)[0].n;

const motivo = e => String((e && e.message) || e).slice(0, 200);

// Avisa o dono do app. Melhor esforço: nunca lança, para não esconder a falha original.
async function alertar(falhas) {
  const resumo = falhas.map(f => `${f.etapa}: ${f.motivo}`).join('; ');
  console.error('[ALERTA] cron diário com falhas: ' + resumo);
  const para = String(process.env.ALERTA_EMAIL || '').trim();
  const email = require('./_email');
  if (!para || !email.configurado()) return false;
  try {
    await email.enviar({
      para,
      assunto: 'SóMaisUmEp: falha no cron diário',
      texto:
        'O cron diário terminou com falhas:\n\n' +
        falhas.map(f => `- ${f.etapa}: ${f.motivo}`).join('\n') +
        '\n\nOs avisos de hoje podem não ter saído. Veja os logs da função api/cron.js na Vercel.',
      html:
        '<p>O cron diário terminou com falhas:</p><ul>' +
        falhas.map(f => `<li><b>${esc(f.etapa)}</b>: ${esc(f.motivo)}</li>`).join('') +
        '</ul><p>Os avisos de hoje podem não ter saído. Veja os logs da função <code>api/cron.js</code> na Vercel.</p>',
    });
    return true;
  } catch (e) {
    console.error('alerta por e-mail:', e.message);
    return false;
  }
}

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
    const falhas = [];
    // 1) Datas de lançamento: consulta o TMDb (deduplicado entre contas, em lotes e com limite de tempo). Falha aqui não impede os avisos.
    let proximos = { ativo: false };
    try {
      proximos = await require('./_atualizar').atualizarProximos(sql, { agora });
    } catch (e) {
      console.error('cron proximos:', e.message);
      falhas.push({ etapa: 'proximos', motivo: motivo(e) });
      proximos = { ativo: true, erro: true };
    }
    // 2) Avisos de lançamento por push (só se as chaves VAPID estiverem configuradas). Falha aqui não impede o resto da faxina.
    let push = { ativo: false };
    try {
      push = await require('./_notificar').enviarLancamentos(sql, { agora });
    } catch (e) {
      console.error('cron push:', e.message);
      falhas.push({ etapa: 'push', motivo: motivo(e) });
      push = { ativo: true, erro: true };
    }
    // Por último, a etapa mais lenta (lista o Blob): se ela estourar o tempo, as datas e os avisos já foram feitos.
    let capasBlob = 0;
    try {
      capasBlob = await varrerCapas(sql);
    } catch (e) {
      console.error('cron capas:', e.message);
      falhas.push({ etapa: 'capas', motivo: motivo(e) });
      capasBlob = null;
    }
    const resumo = { tentativas, links, capasBlob, capasRegistro, proximos, push };
    if (!falhas.length) return res.json({ ok: true, ...resumo });
    const avisado = await alertar(falhas);
    res.status(500).json({ ok: false, falhas, avisado, ...resumo });
  },
  true,
);
