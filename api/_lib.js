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
// Formato guardado: "scrypt$N$r$p$salt$hash" (parâmetros dentro do próprio hash, então dá para subir o custo no futuro sem
// invalidar ninguém: quem entra com um hash de parâmetros antigos tem a senha regravada com os atuais, veja precisaRehash).
// Formato legado (antes dos parâmetros ficarem no hash): "scrypt$salt$hash", sempre com N=16384, r=8, p=1.
// Custo atual: o mínimo recomendado pela OWASP para scrypt (N=2^17, r=8, p=1), ~128 MiB de memória por conferência.
const SCRYPT = { N: 2 ** 17, r: 8, p: 1 };
const SCRYPT_LEGADO = { N: 2 ** 14, r: 8, p: 1 };
const TAM_HASH = 64;
const memoria = ({ N, r }) => 128 * N * r;
const scrypt = (senha, salt, { N, r, p } = SCRYPT, tam = TAM_HASH) =>
  new Promise((ok, no) =>
    crypto.scrypt(String(senha).normalize('NFKC'), salt, tam, { N, r, p, maxmem: memoria({ N, r }) * 2 }, (e, k) => (e ? no(e) : ok(k))),
  );

// Lê um hash guardado. Devolve null se o formato não é reconhecido ou os parâmetros são absurdos (um valor adulterado
// no banco não pode fazer o servidor gastar memória sem limite).
function lerHash(guardado) {
  const partes = String(guardado || '').split('$');
  let params, salt, h;
  if (partes[0] !== 'scrypt') return null;
  if (partes.length === 3) {
    params = SCRYPT_LEGADO;
    [, salt, h] = partes;
  } else if (partes.length === 6) {
    params = { N: Number(partes[1]), r: Number(partes[2]), p: Number(partes[3]) };
    [, , , , salt, h] = partes;
  } else return null;
  const { N, r, p } = params;
  const ok =
    Number.isInteger(Math.log2(N)) && N >= 2 ** 14 && N <= 2 ** 18 && Number.isInteger(r) && r >= 1 && r <= 16 && Number.isInteger(p) && p >= 1 && p <= 4;
  if (!ok || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{64,256}$/.test(h || '') || h.length % 2) return null;
  return { params, salt: Buffer.from(salt, 'hex'), h };
}
const formato = ({ N, r, p }, salt, h) => `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${h.toString('hex')}`;

async function hashSenha(senha) {
  const salt = crypto.randomBytes(16);
  return formato(SCRYPT, salt, await scrypt(senha, salt));
}
// Hash de mentira com os parâmetros atuais: gasta o mesmo tempo quando o e-mail não existe ou o hash guardado é inválido.
const HASH_FALSO = formato(SCRYPT, Buffer.alloc(16), Buffer.alloc(TAM_HASH));
async function confereSenha(senha, guardado) {
  const l = lerHash(guardado);
  if (!l) {
    await scrypt(senha, Buffer.alloc(16));
    return false;
  }
  return igual((await scrypt(senha, l.salt, l.params, l.h.length / 2)).toString('hex'), l.h);
}
// true quando o hash guardado usa parâmetros diferentes dos atuais (ou o formato legado). Chame só depois de confereSenha dar true.
function precisaRehash(guardado) {
  const l = lerHash(guardado);
  return !!l && (l.params.N !== SCRYPT.N || l.params.r !== SCRYPT.r || l.params.p !== SCRYPT.p || String(guardado).split('$').length !== 6);
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
      if (!origemOk(req)) return res.status(403).json({ erro: 'Origem não permitida' }); // CSRF: antes de qualquer acesso ao banco
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

module.exports = { db, rota, erro, assinar, igual, hashSenha, confereSenha, precisaRehash, lerHash, HASH_FALSO, SCRYPT, criarSessao, encerrarSessao, renovarSessao, logado };
