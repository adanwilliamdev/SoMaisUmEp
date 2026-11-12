const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');
const { erro } = require('./_erro');
const { origemOk } = require('./_origem');

const OBRIGATORIAS = ['SESSION_SECRET', 'DATABASE_URL'];

let _sql;
const db = () => (_sql = _sql || neon(process.env.DATABASE_URL)); // use: await db()`select ...`

const assinar = v => crypto.createHmac('sha256', process.env.SESSION_SECRET).update(String(v)).digest('hex');
const igual = (a, b) => {
  const x = Buffer.from(String(a)),
    y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/* ---------- senhas (scrypt, nativo do Node) ---------- */
const scrypt = (senha, salt) =>
  new Promise((ok, no) =>
    crypto.scrypt(String(senha).normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? no(e) : ok(k))),
  );
async function hashSenha(senha) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${(await scrypt(senha, salt)).toString('hex')}`;
}
async function confereSenha(senha, guardado) {
  const [tipo, salt, h] = String(guardado || '').split('$');
  if (tipo !== 'scrypt' || !salt || !h) {
    await scrypt(senha, Buffer.alloc(16));
    return false;
  } // gasta o mesmo tempo
  return igual((await scrypt(senha, Buffer.from(salt, 'hex'))).toString('hex'), h);
}

/* ---------- sessão: cookie assinado "id.versao.validade.assinatura" ---------- */
// A 'versao' do usuário fica no banco: aumentá-la derruba todas as sessões ("sair de todos os dispositivos").
const DIAS = 30;
function criarSessao(res, u) {
  const v = `${u.id}.${u.versao}.${Date.now() + DIAS * 864e5}`;
  res.setHeader('Set-Cookie', `sessao=${v}.${assinar(v)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${DIAS * 86400}`);
}
function encerrarSessao(res) {
  res.setHeader('Set-Cookie', 'sessao=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
}
async function logado(req) {
  const m = /(?:^|;\s*)sessao=([\w-]{1,64})\.(\d{1,9})\.(\d{10,16})\.([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!m || Date.now() >= Number(m[3]) || !igual(m[4], assinar(`${m[1]}.${m[2]}.${m[3]}`))) return null;
  const [u] = await db()`select id, nome, email, versao from usuarios where id = ${m[1]}`;
  return u && u.versao === Number(m[2]) ? { id: u.id, nome: u.nome, email: u.email, versao: u.versao, expira: Number(m[3]) } : null;
}
// Renovação deslizante: quando faltam menos de 7 dos 30 dias, emite um cookie novo (mesma versão). Quem usa o app
// de vez em quando não é deslogado; quem some por mais de 30 dias é. Só vale em respostas privadas (veja dados.js):
// nunca em respostas com cache público, para o Set-Cookie não ser servido a outra pessoa.
const RENOVAR_ABAIXO = 7 * 864e5;
function renovarSessao(res, u) {
  if (u && u.expira && u.expira - Date.now() < RENOVAR_ABAIXO) criarSessao(res, u);
}

// Traduz falhas comuns do banco em mensagens que dizem o que corrigir.
// (Textos fixos: nunca repassam a mensagem original, que pode conter dados da conexão.)
function erroDoBanco(e) {
  const code = e && (e.code || (e.sourceError && e.sourceError.code)),
    msg = String((e && e.message) || '');
  if (code === '42P01' || code === '42703' || /relation .* does not exist|column .* does not exist/i.test(msg))
    return 'O banco está desatualizado. Rode o conteúdo de neon/schema.sql no SQL Editor do Neon.';
  if (code === '28P01' || code === '28000' || /password authentication failed/i.test(msg))
    return 'O banco recusou o usuário/senha da DATABASE_URL. Copie a connection string de novo no Neon.';
  if (code === '3D000') return 'O banco informado na DATABASE_URL não existe. Confira o nome do banco na connection string.';
  if (/connection string|fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|Error connecting to database|Invalid URL/i.test(msg + ' ' + (e && e.name)))
    return 'Não foi possível conectar ao banco. Confira a DATABASE_URL (use a connection string do Neon) e faça um Redeploy.';
  return null;
}

// Envolve cada endpoint: método, variáveis de ambiente, autenticação e erros.
// fn recebe (req, res, usuario); usuario é null nas rotas públicas.
const rota =
  (metodo, fn, publica = false) =>
  async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.method !== metodo) return res.status(405).json({ erro: 'Método não permitido' });
      if (!origemOk(req)) return res.status(403).json({ erro: 'Origem não permitida' });
      const falta = OBRIGATORIAS.filter(k => !process.env[k]);
      if (falta.length) throw erro('Variáveis de ambiente ausentes: ' + falta.join(', '), 500);
      let usuario = null;
      if (!publica) {
        usuario = await logado(req);
        if (!usuario) return res.status(401).json({ erro: 'Não autorizado' });
      }
      await fn(req, res, usuario);
    } catch (e) {
      if (!e.expose) console.error(e);
      const dica = e.expose ? null : erroDoBanco(e);
      res.status(e.status || 500).json({ erro: e.expose ? e.message : dica || 'Erro no servidor' });
    }
  };

module.exports = { db, rota, erro, assinar, igual, hashSenha, confereSenha, criarSessao, encerrarSessao, renovarSessao, logado };
