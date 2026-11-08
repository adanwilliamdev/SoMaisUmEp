const { db, rota, erro } = require('./_lib');
const { roteador } = require('./_roteador');
const L = require('./_limite');
const { consultas } = require('./_consultas');

// Consultas por hora e por conta que chegam até o TMDb. As respostas vêm com cache na Vercel (s-maxage), então só as que
// furam o cache passam por aqui e gastam a cota do token; é isso que o limite conta. Folgado para uso normal (busca, detalhes, descobrir).
const CONSULTAS_POR_HORA = 600;

// GET = consultas ao TMDb (?acao=busca|detalhe|streaming|tendencias|parecidos, em _consultas.js);
// POST = importação em lote (_importar.js). Um só arquivo para caber no limite de funções da Vercel (plano Hobby: 12).
const consultar = rota('GET', async (req, res, u) => {
  const { acao, tipo } = req.query;
  if (!['tv', 'movie'].includes(tipo)) throw erro('Tipo inválido');
  if (!Object.hasOwn(consultas, acao)) throw erro('Ação inválida');
  const sql = db(),
    lim = [L.janela('tm', u.id, CONSULTAS_POR_HORA, 36e5)]; // janela fixa de 1 h por conta
  await L.verificar(sql, lim);
  await L.registrarFalha(sql, lim); // toda consulta conta
  return consultas[acao](req, res, tipo);
});

module.exports = roteador({ GET: consultar, POST: (req, res) => require('./_importar')(req, res) });
