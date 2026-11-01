const { rota, encerrarSessao } = require('./_lib');

module.exports = rota('POST', async (req, res) => {
  encerrarSessao(res);
  res.json({ ok: true });
}, true);
