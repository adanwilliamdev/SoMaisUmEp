// POST /api/sync = sincronização da biblioteca; POST /api/capa (reescrito para ?r=capa no vercel.json) = envio de capa para o Blob.
// Um só arquivo para caber no limite de funções da Vercel (plano Hobby: 12). Os handlers ficam em api/_h/.
module.exports = (req, res) => {
  const r = req.query && req.query.r;
  return require(r === 'capa' ? './_h/capa' : './_h/sync')(req, res);
};
