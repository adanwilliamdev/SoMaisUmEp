// Tokens de redefinição de senha: o link leva o token; o banco guarda só o hash (vazar o banco não vaza links).
const crypto = require('crypto');

const HORA = 36e5;
const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const valido = t => /^[a-f0-9]{64}$/.test(String(t || ''));
function novo(agora = Date.now()) {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token), expira: agora + HORA };
}

module.exports = { novo, hashToken, valido, HORA };
