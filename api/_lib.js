const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

const OBRIGATORIAS = ['SESSION_SECRET', 'APP_PASSWORD', 'DATABASE_URL'];
const erro = (msg, status = 400) => Object.assign(new Error(msg), { expose: true, status });

let _sql;
const db = () => (_sql = _sql || neon(process.env.DATABASE_URL)); // use: await db()`select ...`

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

// Traduz falhas comuns do banco em mensagens que dizem o que corrigir.
// (Textos fixos: nunca repassam a mensagem original, que pode conter dados da conexão.)
function erroDoBanco(e) {
  const code = e && (e.code || (e.sourceError && e.sourceError.code)), msg = String((e && e.message) || '');
  if (code === '42P01' || /relation .* does not exist/i.test(msg)) return 'O banco está sem as tabelas. Rode o conteúdo de neon/schema.sql no SQL Editor do Neon.';
  if (code === '28P01' || code === '28000' || /password authentication failed/i.test(msg)) return 'O banco recusou o usuário/senha da DATABASE_URL. Copie a connection string de novo no Neon.';
  if (code === '3D000') return 'O banco informado na DATABASE_URL não existe. Confira o nome do banco na connection string.';
  if (/connection string|fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|Error connecting to database|Invalid URL/i.test(msg + ' ' + (e && e.name))) return 'Não foi possível conectar ao banco. Confira a DATABASE_URL (use a connection string do Neon) e faça um Redeploy.';
  return null;
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
    const dica = e.expose ? null : erroDoBanco(e);
    res.status(e.status || 500).json({ erro: e.expose ? e.message : dica || 'Erro no servidor' });
  }
};

module.exports = { db, rota, erro, assinar, igual, criarSessao, encerrarSessao, logado };
