// Limite de tentativas guardado no banco (funciona em serverless, onde a memória não é compartilhada).
const crypto = require('crypto');
const { erro } = require('./_erro');

const MIN = 6e4;
// 'limite' falhas seguidas bloqueiam por 15 min; a cada 3 falhas a mais o bloqueio dobra (máx. 24 h).
const bloqueioMs = (falhas, limite = 5) => (falhas < limite ? 0 : Math.min(15 * MIN * 2 ** Math.floor((falhas - limite) / 3), 24 * 60 * MIN));

const hash = v => crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 32);
const ipDe = req => String((req.headers['x-forwarded-for'] || '').split(',')[0] || req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'desconhecido').trim();
// O limite por e-mail (5) é a proteção principal contra adivinhar senha. O limite por IP é só uma rede de segurança contra
// varredura de muitos e-mails e fica alto de propósito: operadoras móveis brasileiras põem muita gente atrás do mesmo IP (CGNAT).
const LIMITE_IP = 100;
const chaves = (req, email) => [{ k: 'ip:' + hash(ipDe(req)), limite: LIMITE_IP }, ...(email ? [{ k: 'em:' + hash(email), limite: 5 }] : [])];
// Contadores separados por finalidade (ex.: 'rs' = recuperar senha), para não misturar com os do login.
const chavesDe = (req, prefixo, { ip = LIMITE_IP, alvo = null, limiteAlvo = 5 } = {}) =>
  [{ k: prefixo + '-ip:' + hash(ipDe(req)), limite: ip }, ...(alvo ? [{ k: prefixo + ':' + hash(alvo), limite: limiteAlvo }] : [])];

// Janela fixa: no máximo `limite` usos por `janelaMs` (ex.: 30 cadastros por dia por IP). Ao chegar no limite, bloqueia até o
// fim da janela; na janela seguinte a chave é outra e o contador recomeça do zero. Não usa o bloqueio crescente do login.
const janela = (prefixo, alvo, limite, janelaMs, agora = Date.now()) => {
  const n = Math.floor(agora / janelaMs);
  return { k: `${prefixo}:${hash(alvo)}:${n}`, limite, fixoAte: (n + 1) * janelaMs };
};

async function verificar(sql, lista) {
  const rows = await sql`select ate from tentativas where chave = any(${lista.map(c => c.k)}) and ate > ${Date.now()}`;
  if (rows.length) {
    const resta = Math.max(...rows.map(r => Number(r.ate))) - Date.now();
    throw erro(`Muitas tentativas. Tente de novo em ${Math.max(1, Math.ceil(resta / MIN))} min.`, 429);
  }
}

async function registrarFalha(sql, lista) {
  const agora = Date.now();
  for (const { k, limite, fixoAte } of lista) {
    const [r] = await sql`
      insert into tentativas (chave, falhas, ate, ultima) values (${k}, 1, 0, ${agora})
      on conflict (chave) do update set
        falhas = case when tentativas.ultima < ${agora - 864e5} then 1 else tentativas.falhas + 1 end, ultima = ${agora}
      returning falhas`;
    const ms = fixoAte ? (r.falhas >= limite ? fixoAte - agora : 0) : bloqueioMs(r.falhas, limite);
    if (ms > 0) await sql`update tentativas set ate = ${agora + ms} where chave = ${k}`;
  }
}

const limpar = (sql, lista) => sql`delete from tentativas where chave = any(${lista.map(c => c.k)})`;

module.exports = { LIMITE_IP, janela, bloqueioMs, chaves, chavesDe, hash, verificar, registrarFalha, limpar, ipDe };
