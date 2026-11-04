// Limite de tentativas guardado no banco (funciona em serverless, onde a memória não é compartilhada).
const crypto = require('crypto');
const { erro } = require('./_erro');

const MIN = 6e4;
// 'limite' falhas seguidas bloqueiam por 15 min; a cada 3 falhas a mais o bloqueio dobra (máx. 24 h).
const bloqueioMs = (falhas, limite = 5) => (falhas < limite ? 0 : Math.min(15 * MIN * 2 ** Math.floor((falhas - limite) / 3), 24 * 60 * MIN));

const hash = v => crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 32);
const ipDe = req => String((req.headers['x-forwarded-for'] || '').split(',')[0] || req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'desconhecido').trim();
const chaves = (req, email) => [{ k: 'ip:' + hash(ipDe(req)), limite: 20 }, ...(email ? [{ k: 'em:' + hash(email), limite: 5 }] : [])];
// Contadores separados por finalidade (ex.: 'rs' = recuperar senha), para não misturar com os do login.
const chavesDe = (req, prefixo, { ip = 20, alvo = null, limiteAlvo = 5 } = {}) =>
  [{ k: prefixo + '-ip:' + hash(ipDe(req)), limite: ip }, ...(alvo ? [{ k: prefixo + ':' + hash(alvo), limite: limiteAlvo }] : [])];

async function verificar(sql, lista) {
  const rows = await sql`select ate from tentativas where chave = any(${lista.map(c => c.k)}) and ate > ${Date.now()}`;
  if (rows.length) {
    const resta = Math.max(...rows.map(r => Number(r.ate))) - Date.now();
    throw erro(`Muitas tentativas. Tente de novo em ${Math.max(1, Math.ceil(resta / MIN))} min.`, 429);
  }
}

async function registrarFalha(sql, lista) {
  const agora = Date.now();
  for (const { k, limite } of lista) {
    const [r] = await sql`
      insert into tentativas (chave, falhas, ate, ultima) values (${k}, 1, 0, ${agora})
      on conflict (chave) do update set
        falhas = case when tentativas.ultima < ${agora - 864e5} then 1 else tentativas.falhas + 1 end, ultima = ${agora}
      returning falhas`;
    const ms = bloqueioMs(r.falhas, limite);
    if (ms) await sql`update tentativas set ate = ${agora + ms} where chave = ${k}`;
  }
}

const limpar = (sql, lista) => sql`delete from tentativas where chave = any(${lista.map(c => c.k)})`;

module.exports = { bloqueioMs, chaves, chavesDe, hash, verificar, registrarFalha, limpar, ipDe };
