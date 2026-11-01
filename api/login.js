const { rota, assinar, igual, criarSessao } = require('./_lib');

module.exports = rota('POST', async (req, res) => {
  const senha = String((req.body || {}).senha || '');
  if (!igual(assinar(senha), assinar(process.env.APP_PASSWORD))) {
    await new Promise(r => setTimeout(r, 800)); // freia tentativas em sequência
    return res.status(401).json({ erro: 'Senha incorreta' });
  }
  criarSessao(res);
  res.json({ ok: true });
}, true);
