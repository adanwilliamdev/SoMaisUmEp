const { db, rota, erro } = require('./_lib');
const { roteador } = require('./_roteador');
const { consultas } = require('./_consultas');
const L = require('./_limite');

const CONSULTAS_POR_HORA = 1500; // por conta; a cache da Vercel absorve as repetidas, então uso normal fica muito abaixo disso

// GET = consultas ao TMDb (?acao=busca|detalhe|streaming|tendencias|parecidos, em _consultas.js);
// POST = importação em lote (_importar.js). Um só arquivo para caber no limite de funções da Vercel (plano Hobby: 12).
const consultar = rota('GET', async (req, res, u) => {
  const { acao, tipo } = req.query;
  if (!['tv', 'movie'].includes(tipo)) throw erro('Tipo inválido');
  if (!Object.hasOwn(consultas, acao)) throw erro('Ação inválida');
  // Protege a cota da chave do TMDb contra uma conta que dispara consultas sem parar (janela fixa de 1 h).
  const sql = db(),
    lim = [L.janela('tm', u.id, CONSULTAS_POR_HORA, 36e5)];
  await L.verificar(sql, lim);
  await L.registrarFalha(sql, lim);
  return consultas[acao](req, res, tipo);
});

module.exports = roteador({ GET: consultar, POST: (req, res) => require('./_importar')(req, res) });
