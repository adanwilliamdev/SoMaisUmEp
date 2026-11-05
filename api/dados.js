const { db, rota } = require('./_lib');
const { etagDe, confere } = require('./_etag');

const n = v => (v == null ? null : Number(v));

// O navegador revalida a cada chamada (If-None-Match); se nada mudou, a resposta é 304 e a biblioteca
// nem chega a ser lida do banco: só duas consultas de contagem/última alteração.
module.exports = rota('GET', async (req, res, u) => {
  const sql = db(), blob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const [[a], [b]] = await Promise.all([
    sql`select count(*)::int as n, coalesce(max(atualizado), 0) as m from titulos where user_id = ${u.id}`,
    sql`select count(*)::int as n, coalesce(max(atualizado), 0) as m, count(publico)::int as p, coalesce(max(publico_em), 0) as pm from tops where user_id = ${u.id}`,
  ]);
  const tag = etagDe('v1', u.id, u.nome, u.email, blob, a.n, a.m, b.n, b.m, b.p, b.pm);
  res.setHeader('Cache-Control', 'private, no-cache');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('ETag', tag);
  if (confere(req, tag)) return res.status(304).end();

  const [t, p] = await Promise.all([
    sql`select * from titulos where user_id = ${u.id} order by criado desc`,
    sql`select * from tops where user_id = ${u.id} order by criado desc`,
  ]);
  res.json({
    usuario: { id: u.id, nome: u.nome, email: u.email },
    blob, // se true, as capas enviadas vão para o Vercel Blob
    series: t.map(r => ({
      id: r.id, tipo: r.tipo, nome: r.nome, capa: r.capa, sinopse: r.sinopse, ano: r.ano, nota: n(r.nota), duracao: r.duracao, tmdb: r.tmdb,
      eps: r.eps, vis: r.vis, criado: Number(r.criado), atualizado: Number(r.atualizado),
      nota_pessoal: n(r.nota_pessoal), resenha: r.resenha, visto_em: n(r.visto_em), hist: r.hist || {}, proximo: r.proximo || null,
    })),
    tops: p.map(r => ({ id: r.id, nome: r.nome, itens: r.itens, criado: Number(r.criado), atualizado: Number(r.atualizado) })),
    links: Object.fromEntries(p.filter(r => r.publico).map(r => [r.id, r.publico])), // id do top -> código do link público
  });
});
