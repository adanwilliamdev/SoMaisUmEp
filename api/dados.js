const { db, rota } = require('./_lib');

const n = v => (v == null ? null : Number(v));

module.exports = rota('GET', async (req, res, u) => {
  const sql = db();
  const [t, p] = await Promise.all([
    sql`select * from titulos where user_id = ${u.id} order by criado desc`,
    sql`select * from tops where user_id = ${u.id} order by criado desc`,
  ]);
  res.json({
    usuario: { id: u.id, nome: u.nome, email: u.email },
    blob: !!process.env.BLOB_READ_WRITE_TOKEN, // se true, as capas enviadas vão para o Vercel Blob
    series: t.map(r => ({
      id: r.id, tipo: r.tipo, nome: r.nome, capa: r.capa, sinopse: r.sinopse, ano: r.ano, nota: n(r.nota), duracao: r.duracao, tmdb: r.tmdb,
      eps: r.eps, vis: r.vis, criado: Number(r.criado), atualizado: Number(r.atualizado),
      nota_pessoal: n(r.nota_pessoal), resenha: r.resenha, visto_em: n(r.visto_em), hist: r.hist || {},
    })),
    tops: p.map(r => ({ id: r.id, nome: r.nome, itens: r.itens, criado: Number(r.criado), atualizado: Number(r.atualizado) })),
  });
});
