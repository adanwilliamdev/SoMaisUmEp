// Todas as ações de conta num só arquivo (cada arquivo público de api/ vira uma função na Vercel; o plano Hobby aceita 12).
// Os endereços antigos continuam valendo: o vercel.json reescreve /api/login -> /api/auth?a=login, e assim por diante.
// Cada handler fica em api/_h/ (pasta com _ não vira função) e só é carregado quando usado.
const ACOES = ['login', 'logout', 'cadastro', 'esqueci', 'redefinir', 'conta'];

module.exports = (req, res) => {
  const a = req.query && req.query.a;
  if (typeof a !== 'string' || !ACOES.includes(a)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).json({ erro: 'Ação inválida' });
  }
  return require('./_h/' + a)(req, res);
};
