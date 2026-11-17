const { db, rota, renovarSessao } = require('./_lib');
const { etagDe, confere } = require('./_etag');
const { roteador } = require('./_roteador');

const n = v => (v == null ? null : Number(v));

// O navegador revalida a cada chamada (If-None-Match); se nada mudou, a resposta é 304 e a biblioteca
// nem chega a ser lida do banco: só duas consultas de contagem/última alteração.
// Sincronização incremental: com ?desde=<versão>, só voltam os títulos/tops alterados desde então (campo `atualizado`),
// mais a lista de todos os ids que existem (o navegador remove o que sumiu). Sem ?desde, vem a biblioteca inteira.
const desdeDe = req => {
  const n = Number(req.query && req.query.desde);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

const dados = rota('GET', async (req, res, u) => {
  const sql = db(),
    blob = !!process.env.BLOB_READ_WRITE_TOKEN,
    desde = desdeDe(req);
  const [[a], [b]] = await Promise.all([
    sql`select count(*)::int as n, coalesce(max(atualizado), 0) as m from titulos where user_id = ${u.id}`,
    sql`select count(*)::int as n, coalesce(max(atualizado), 0) as m, count(publico)::int as p, coalesce(max(publico_em), 0) as pm from tops where user_id = ${u.id}`,
  ]);
  const tag = etagDe('v1', u.id, u.nome, u.email, blob, a.n, a.m, b.n, b.m, b.p, b.pm, desde || '');
  renovarSessao(res, u); // resposta privada (no-cache + Vary: Cookie): pode renovar o cookie
  res.setHeader('Cache-Control', 'private, no-cache');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('ETag', tag);
  if (confere(req, tag)) return res.status(304).end();

  const [t, p] = await Promise.all(
    desde
      ? [
          sql`select * from titulos where user_id = ${u.id} and atualizado >= ${desde} order by criado desc`,
          sql`select * from tops where user_id = ${u.id} and atualizado >= ${desde} order by criado desc`,
        ]
      : [sql`select * from titulos where user_id = ${u.id} order by criado desc`, sql`select * from tops where user_id = ${u.id} order by criado desc`],
  );
  let ids = null;
  if (desde) {
    const [a, b] = await Promise.all([sql`select id from titulos where user_id = ${u.id}`, sql`select id from tops where user_id = ${u.id}`]);
    ids = { series: a.map(r => r.id), tops: b.map(r => r.id) };
  }
  const links = desde
    ? await sql`select id, publico from tops where user_id = ${u.id} and publico is not null`
    : p.filter(r => r.publico);
  res.json({
    usuario: { id: u.id, nome: u.nome, email: u.email },
    blob, // se true, as capas enviadas vão para o Vercel Blob
    ...(desde ? { parcial: true, ids } : {}),
    series: t.map(r => ({
      id: r.id,
      tipo: r.tipo,
      nome: r.nome,
      capa: r.capa,
      sinopse: r.sinopse,
      ano: r.ano,
      nota: n(r.nota),
      duracao: r.duracao,
      tmdb: r.tmdb,
      eps: r.eps,
      vis: r.vis,
      criado: Number(r.criado),
      atualizado: Number(r.atualizado),
      nota_pessoal: n(r.nota_pessoal),
      resenha: r.resenha,
      visto_em: n(r.visto_em),
      hist: r.hist || {},
      proximo: r.proximo || null,
      situacao: r.situacao || null,
    })),
    tops: p.map(r => ({ id: r.id, nome: r.nome, itens: r.itens, criado: Number(r.criado), atualizado: Number(r.atualizado) })),
    links: Object.fromEntries(links.map(r => [r.id, r.publico])), // id do top -> código do link público
  });
});

// Health check (GET ?r=saude): público e sem cache, para monitoramento. Nunca repassa a mensagem de erro do banco.
async function saude(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const config = {
    sessao: !!process.env.SESSION_SECRET,
    banco: !!process.env.DATABASE_URL,
    blob: !!process.env.BLOB_READ_WRITE_TOKEN,
  };
  const versao = String(process.env.VERCEL_GIT_COMMIT_SHA || 'dev')
    .slice(0, 7)
    .replace(/[^\w-]/g, '');
  let banco = 'ok';
  try {
    if (!config.banco) throw new Error('sem DATABASE_URL');
    await db()`select 1`;
  } catch (e) {
    console.error('saude', e.message);
    banco = 'erro';
  }
  const ok = banco === 'ok' && config.sessao;
  res.status(ok ? 200 : 503).json({ ok, banco, config, versao });
}

// GET = a biblioteca (acima); GET ?r=saude (health check), GET ?r=push e POST = notificações push (_push.js). Um só arquivo para caber no limite
// de funções da Vercel (plano Hobby: 12).
module.exports = roteador({
  GET: (req, res) => {
    const r = req.query && req.query.r;
    if (r === 'saude') return saude(req, res);
    return r === 'push' ? require('./_push').estado(req, res) : dados(req, res);
  },
  POST: (req, res) => require('./_push').comando(req, res),
});
