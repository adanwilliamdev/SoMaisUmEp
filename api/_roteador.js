// Junta vários handlers num só arquivo (cada arquivo público de api/ vira uma função na Vercel, e o plano Hobby aceita 12).
// Escolhe o handler pelo método HTTP: roteador({ GET: fn, POST: fn }). Método sem handler responde 405.
const roteador = rotas => (req, res) => {
  const fn = Object.hasOwn(rotas, req.method) ? rotas[req.method] : null;
  if (!fn) {
    res.setHeader('Allow', Object.keys(rotas).join(', '));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  return fn(req, res);
};

module.exports = { roteador };
