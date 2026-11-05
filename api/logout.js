const { db, rota, encerrarSessao, logado } = require('./_lib');

// { todos: true } encerra as sessões de todos os aparelhos (e exige estar logado).
module.exports = rota(
  'POST',
  async (req, res) => {
    if ((req.body || {}).todos) {
      const u = await logado(req);
      if (u) await db()`update usuarios set versao = versao + 1 where id = ${u.id}`;
    }
    encerrarSessao(res);
    res.json({ ok: true });
  },
  true,
);
