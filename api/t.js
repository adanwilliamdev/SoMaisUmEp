const { roteador } = require('./_roteador');

// GET = página pública de um top (_pagina.js); POST = liga/desliga o link, com login (_compartilhar.js).
// Um só arquivo para caber no limite de funções da Vercel (plano Hobby: 12).
module.exports = roteador({
  GET: (req, res) => require('./_pagina')(req, res),
  POST: (req, res) => require('./_compartilhar')(req, res),
});
