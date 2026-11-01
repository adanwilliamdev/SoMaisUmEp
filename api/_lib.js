const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const OBRIGATORIAS = ['SESSION_SECRET', 'APP_PASSWORD', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const erro = (msg, status = 400) => Object.assign(new Error(msg), { expose: true, status });

let _db;
const db = () => (_db = _db || createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }));

const assinar = v => crypto.createHmac('sha256', process.env.SESSION_SECRET).update(String(v)).digest('hex');
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

const DIAS = 30;
function criarSessao(res) {
  const v = String(Date.now() + DIAS * 864e5);
  res.setHeader('Set-Cookie', `sessao=${v}.${assinar(v)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${DIAS * 86400}`);
}
function encerrarSessao(res) {
  res.setHeader('Set-Cookie', 'sessao=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
}
function logado(req) {
  const m = /(?:^|;\s*)sessao=(\d+)\.([a-f0-9]{64})/.exec(req.headers.cookie || '');
  return !!m && Date.now() < Number(m[1]) && igual(m[2], assinar(m[1]));
}

// Envolve cada endpoint: método, variáveis de ambiente, autenticação e erros.
const rota = (metodo, fn, publica = false) => async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== metodo) return res.status(405).json({ erro: 'Método não permitido' });
    const falta = OBRIGATORIAS.filter(k => !process.env[k]);
    if (falta.length) throw erro('Variáveis de ambiente ausentes: ' + falta.join(', '), 500);
    if (!publica && !logado(req)) return res.status(401).json({ erro: 'Não autorizado' });
    await fn(req, res);
  } catch (e) {
    if (!e.expose) console.error(e);
    res.status(e.status || 500).json({ erro: e.expose ? e.message : 'Erro no servidor' });
  }
};

module.exports = { db, rota, erro, assinar, igual, criarSessao, encerrarSessao, logado };
