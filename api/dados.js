const { db, rota } = require('./_lib');

module.exports = rota('GET', async (req, res) => {
  const [t, p] = await Promise.all([
    db().from('titulos').select('*').order('criado', { ascending: false }),
    db().from('tops').select('*').order('criado', { ascending: false }),
  ]);
  if (t.error || p.error) throw t.error || p.error;
  res.json({
    series: t.data.map(r => ({ id: r.id, tipo: r.tipo, nome: r.nome, capa: r.capa, sinopse: r.sinopse, ano: r.ano, nota: r.nota, duracao: r.duracao, tmdb: r.tmdb, eps: r.eps, vis: r.vis, criado: Number(r.criado) })),
    tops: p.data.map(r => ({ id: r.id, nome: r.nome, itens: r.itens, criado: Number(r.criado) })),
  });
});
