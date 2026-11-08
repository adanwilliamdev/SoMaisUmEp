const { rota, erro } = require('./_lib');
const { roteador } = require('./_roteador');
const { consultas } = require('./_consultas');

// GET = consultas ao TMDb (?acao=busca|detalhe|streaming|tendencias|parecidos, em _consultas.js);
// POST = importação em lote (_importar.js). Um só arquivo para caber no limite de funções da Vercel (plano Hobby: 12).
const consultar = rota('GET', async (req, res) => {
  const { acao, tipo } = req.query;
  if (!['tv', 'movie'].includes(tipo)) throw erro('Tipo inválido');
  if (!Object.hasOwn(consultas, acao)) throw erro('Ação inválida');
  return consultas[acao](req, res, tipo);
});

module.exports = roteador({ GET: consultar, POST: (req, res) => require('./_importar')(req, res) });
