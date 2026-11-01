const { db, rota } = require('./_lib');

module.exports = rota('GET', async (req, res) => {
  const sql = db();
  const [t, p] = await Promise.all([
    sql`select * from titulos order by criado desc`,
    sql`select * from tops order by criado desc`,
  ]);
  res.json({
    series: t.map(r => ({ id: r.id, tipo: r.tipo, nome: r.nome, capa: r.capa, sinopse: r.sinopse, ano: r.ano, nota: r.nota == null ? null : Number(r.nota), duracao: r.duracao, tmdb: r.tmdb, eps: r.eps, vis: r.vis, criado: Number(r.criado) })),
    tops: p.map(r => ({ id: r.id, nome: r.nome, itens: r.itens, criado: Number(r.criado) })),
  });
});
