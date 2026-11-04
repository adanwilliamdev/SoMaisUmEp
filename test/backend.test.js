// Testes do backend novo: ETag, migrações, recuperação de senha, conta, cota de capas e cron.
// O banco e o Blob são substituídos por versões falsas (nada de rede): o que se confere é a lógica dos endpoints.
process.env.SESSION_SECRET = 'segredo-de-teste-segredo-de-teste';
process.env.DATABASE_URL = 'postgresql://x:y@localhost/z';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');

/* ---------- banco e Blob falsos ---------- */
const banco = { consultas: [], resposta: () => [] };
const blob = { enviados: [], apagados: [] };
const falsos = {
  '@neondatabase/serverless': { neon: () => {
    const sql = (strings, ...vals) => {
      const texto = strings.join('?').replace(/\s+/g, ' ').trim();
      banco.consultas.push({ texto, vals });
      try { return Promise.resolve(banco.resposta(texto, vals)); } catch (e) { return Promise.reject(e); }
    };
    sql.transaction = qs => Promise.all(qs);
    return sql;
  } },
  '@vercel/blob': {
    put: async p => { blob.enviados.push(p); return { url: 'https://abc.public.blob.vercel-storage.com/' + p }; },
    del: async u => { blob.apagados.push(...[].concat(u)); },
    list: async () => ({ blobs: [], hasMore: false }),
  },
};
const carregar = Module._load;
Module._load = function (req, ...resto) { return falsos[req] || carregar.call(this, req, ...resto); };

const { assinar, hashSenha } = require('../api/_lib');
const { etagDe, confere } = require('../api/_etag');
const T = require('../api/_token');
const M = require('../scripts/migrar');

const USER = { id: 'u1', nome: 'Ana', email: 'ana@exemplo.com', versao: 1 };
const cookie = () => { const v = `${USER.id}.${USER.versao}.${Date.now() + 864e5}`; return `sessao=${v}.${assinar(v)}`; };
const novoRes = () => { const h = {}; return { h, code: 200, body: undefined, ended: false, setHeader(k, v) { h[k.toLowerCase()] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, end() { this.ended = true; return this; } }; };
async function chamar(arquivo, { metodo = 'POST', body, headers = {}, logado = false } = {}) {
  const res = novoRes();
  await require('../api/' + arquivo)({ method: metodo, body, query: {}, headers: { ...(logado ? { cookie: cookie() } : {}), ...headers } }, res);
  return res;
}
const limpar = () => { banco.consultas = []; blob.enviados = []; blob.apagados = []; };
// Respostas padrão: sessão válida e contadores de tentativas vazios; cada teste acrescenta as suas.
const base = extra => (t, v) => {
  if (/select id, nome, email, versao from usuarios/.test(t)) return [USER];
  if (/select ate from tentativas/.test(t)) return [];
  if (/insert into tentativas/.test(t)) return [{ falhas: 1 }];
  return extra ? extra(t, v) || [] : [];
};
const envEmail = () => Object.assign(process.env, { RESEND_API_KEY: 're_teste', EMAIL_FROM: 'SóMaisUmEp <oi@somaisumep.test>', APP_URL: 'https://somaisumep.test/' });

/* ---------- ETag ---------- */
test('etag: igual para os mesmos dados, diferente quando algo muda', () => {
  assert.equal(etagDe('a', 1, 2), etagDe('a', 1, 2));
  assert.notEqual(etagDe('a', 1, 2), etagDe('a', 1, 3));
  assert.match(etagDe('x'), /^W\/"[\w-]{24}"$/);
});
test('etag: If-None-Match aceita lista, "*" e ignora o prefixo W/', () => {
  const t = etagDe('x');
  assert.ok(confere({ headers: { 'if-none-match': t } }, t));
  assert.ok(confere({ headers: { 'if-none-match': t.replace('W/', '') } }, t));
  assert.ok(confere({ headers: { 'if-none-match': `"outro", ${t}` } }, t));
  assert.ok(confere({ headers: { 'if-none-match': '*' } }, t));
  assert.ok(!confere({ headers: {} }, t));
  assert.ok(!confere({ headers: { 'if-none-match': 'W/"outro"' } }, t));
});

test('/api/dados: devolve 304 sem ler a biblioteca quando nada mudou', async () => {
  let m = '100';
  banco.resposta = base(t => (/count\(\*\)::int as n/.test(t) ? [{ n: 2, m }] : []));
  const a = await chamar('dados', { metodo: 'GET', logado: true });
  assert.equal(a.code, 200);
  assert.ok(a.h.etag && a.h['cache-control'] === 'private, no-cache');
  assert.ok(banco.consultas.some(c => /select \* from titulos/.test(c.texto)));

  limpar(); banco.resposta = base(t => (/count\(\*\)::int as n/.test(t) ? [{ n: 2, m }] : []));
  const b = await chamar('dados', { metodo: 'GET', logado: true, headers: { 'if-none-match': a.h.etag } });
  assert.equal(b.code, 304); assert.ok(b.ended);
  assert.ok(!banco.consultas.some(c => /select \* from titulos/.test(c.texto)), 'não pode ler os títulos num 304');

  m = '101'; limpar();
  const c = await chamar('dados', { metodo: 'GET', logado: true, headers: { 'if-none-match': a.h.etag } });
  assert.equal(c.code, 200); assert.notEqual(c.h.etag, a.h.etag);
});

/* ---------- token de redefinição ---------- */
test('token: 64 hex, só o hash é guardado, vale 1 hora', () => {
  const t = T.novo(1000);
  assert.match(t.token, /^[a-f0-9]{64}$/);
  assert.equal(t.hash, T.hashToken(t.token)); assert.notEqual(t.hash, t.token);
  assert.equal(t.expira, 1000 + 36e5);
  assert.ok(T.valido(t.token)); assert.ok(!T.valido('abc')); assert.ok(!T.valido(null));
  assert.notEqual(T.novo().token, T.novo().token);
});

/* ---------- migrações ---------- */
test('migrações: numeração contínua a partir de 001 e arquivos não vazios', () => {
  const l = M.listar();
  assert.ok(l.length >= 2);
  l.forEach((f, i) => assert.equal(f.slice(0, 3), String(i + 1).padStart(3, '0')));
  l.forEach(f => assert.ok(M.comandos(M.ler(f)).length > 0, f));
});
test('migrações: comandos ignora comentários e divide por ";"', () => {
  assert.deepEqual(M.comandos('-- x; y\ncreate table a (id int); -- fim\n\ninsert into a values (1);\n'), ['create table a (id int)', 'insert into a values (1)']);
});
test('neon/schema.sql está em dia com as migrações (rode "npm run schema")', () => {
  assert.equal(fs.readFileSync(path.join(__dirname, '..', 'neon', 'schema.sql'), 'utf8'), M.schemaCompleto());
});

/* ---------- esqueci a senha ---------- */
test('esqueci: responde igual para e-mail existente e inexistente; só o existente recebe o link', async () => {
  envEmail();
  const enviados = []; const fetchOrig = global.fetch;
  global.fetch = async (url, opt) => { enviados.push({ url, body: JSON.parse(opt.body) }); return { ok: true }; };
  try {
    limpar(); banco.resposta = base(t => (/select id, nome from usuarios where email/.test(t) ? [] : []));
    const a = await chamar('esqueci', { body: { email: 'ninguem@exemplo.com' } });
    assert.deepEqual(a.body, { ok: true }); assert.equal(enviados.length, 0);
    assert.ok(!banco.consultas.some(c => /insert into reset_senha/.test(c.texto)));

    limpar(); banco.resposta = base(t => (/select id, nome from usuarios where email/.test(t) ? [{ id: 'u1', nome: 'Ana' }] : []));
    const b = await chamar('esqueci', { body: { email: 'ANA@exemplo.com ' } });
    assert.deepEqual(b.body, { ok: true }); assert.equal(enviados.length, 1);
    assert.equal(enviados[0].url, 'https://api.resend.com/emails');
    assert.deepEqual(enviados[0].body.to, ['ana@exemplo.com']);
    const token = /https:\/\/somaisumep\.test\/#redefinir=([a-f0-9]{64})/.exec(enviados[0].body.text)[1];
    const ins = banco.consultas.find(c => /insert into reset_senha/.test(c.texto));
    assert.ok(ins.vals.includes(T.hashToken(token)) && !ins.vals.includes(token), 'o banco guarda só o hash');
  } finally { global.fetch = fetchOrig; }
});
test('esqueci: sem e-mail configurado avisa (501) e e-mail inválido é recusado', async () => {
  envEmail(); banco.resposta = base();
  assert.equal((await chamar('esqueci', { body: { email: 'sem-arroba' } })).code, 400);
  delete process.env.RESEND_API_KEY;
  assert.equal((await chamar('esqueci', { body: { email: 'ana@exemplo.com' } })).code, 501);
});
test('esqueci: bloqueia depois de muitos pedidos para o mesmo e-mail', async () => {
  envEmail(); const padrao = base(); banco.resposta = (t, v) => (/select ate from tentativas/.test(t) ? [{ ate: Date.now() + 6e5 }] : padrao(t, v));
  const r = await chamar('esqueci', { body: { email: 'ana@exemplo.com' } });
  assert.equal(r.code, 429);
});

/* ---------- redefinir ---------- */
test('redefinir: token malformado, desconhecido e senha curta são recusados', async () => {
  banco.resposta = base();
  assert.equal((await chamar('redefinir', { body: { token: 'xyz', senha: 'senha-boa-123' } })).code, 400);
  assert.equal((await chamar('redefinir', { body: { token: 'a'.repeat(64), senha: 'senha-boa-123' } })).code, 400);   // não achou no banco
  assert.equal((await chamar('redefinir', { body: { token: 'a'.repeat(64), senha: '123' } })).code, 400);
});
test('redefinir: troca a senha, encerra as sessões (versao + 1) e consome o token', async () => {
  const token = 'b'.repeat(64);
  limpar(); banco.resposta = base(t => (/with t as \(delete from reset_senha/.test(t) ? [{ id: 'u1', email: 'ana@exemplo.com' }] : []));
  const r = await chamar('redefinir', { body: { token, senha: 'senha-boa-123' } });
  assert.deepEqual(r.body, { ok: true });
  const q = banco.consultas.find(c => /with t as \(delete from reset_senha/.test(c.texto));
  assert.match(q.texto, /versao = versao \+ 1/);
  assert.ok(q.vals.includes(T.hashToken(token)) && !q.vals.includes(token));
  assert.ok(banco.consultas.some(c => /delete from reset_senha where user_id/.test(c.texto)), 'apaga os outros links pendentes');
});

/* ---------- conta ---------- */
test('conta: senha errada dá 403 (nunca 401, que derrubaria a sessão no app)', async () => {
  const senha_hash = await hashSenha('senha-certa-1');
  banco.resposta = base(t => (/select senha_hash from usuarios/.test(t) ? [{ senha_hash }] : []));
  const r = await chamar('conta', { logado: true, body: { acao: 'excluir', senha: 'errada' } });
  assert.equal(r.code, 403);
  assert.equal((await chamar('conta', { body: { acao: 'excluir', senha: 'x' } })).code, 401);                // sem sessão
  assert.equal((await chamar('conta', { logado: true, body: { acao: 'hackear', senha: 'x' } })).code, 400);  // ação inexistente
});
test('conta: trocar senha mantém este aparelho logado com a nova versão da sessão', async () => {
  const senha_hash = await hashSenha('senha-certa-1');
  limpar(); banco.resposta = base(t => (/select senha_hash from usuarios/.test(t) ? [{ senha_hash }] : /update usuarios set senha_hash/.test(t) ? [{ versao: 2 }] : []));
  const r = await chamar('conta', { logado: true, body: { acao: 'senha', senha: 'senha-certa-1', nova: 'outra-senha-2' } });
  assert.deepEqual(r.body, { ok: true });
  assert.match(r.h['set-cookie'], /^sessao=u1\.2\./);
  assert.equal((await chamar('conta', { logado: true, body: { acao: 'senha', senha: 'senha-certa-1', nova: 'curta' } })).code, 400);
});
test('conta: trocar e-mail normaliza e avisa quando já está em uso (409)', async () => {
  const senha_hash = await hashSenha('senha-certa-1');
  limpar(); banco.resposta = base(t => (/select senha_hash from usuarios/.test(t) ? [{ senha_hash }] : []));
  const ok = await chamar('conta', { logado: true, body: { acao: 'email', senha: 'senha-certa-1', email: ' NOVO@Exemplo.com' } });
  assert.deepEqual(ok.body, { ok: true, email: 'novo@exemplo.com' });
  banco.resposta = base(t => { if (/select senha_hash from usuarios/.test(t)) return [{ senha_hash }]; if (/update usuarios set email/.test(t)) throw Object.assign(new Error('duplicate key'), { code: '23505' }); return []; });
  assert.equal((await chamar('conta', { logado: true, body: { acao: 'email', senha: 'senha-certa-1', email: 'outro@exemplo.com' } })).code, 409);
});
test('conta: excluir apaga o usuário, as capas do Blob (só as dele) e encerra a sessão', async () => {
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_teste';
  const senha_hash = await hashSenha('senha-certa-1'), meu = 'https://abc.public.blob.vercel-storage.com/capas/u1/capa-1.jpg';
  limpar(); banco.resposta = base(t => /select senha_hash from usuarios/.test(t) ? [{ senha_hash }]
    : /select capa as url from titulos/.test(t) ? [{ url: meu }, { url: 'https://image.tmdb.org/t/p/w342/a.jpg' }, { url: 'https://abc.public.blob.vercel-storage.com/capas/outro/capa.jpg' }]
    : /select url from capas/.test(t) ? [{ url: meu }] : []);
  const r = await chamar('conta', { logado: true, body: { acao: 'excluir', senha: 'senha-certa-1' } });
  assert.deepEqual(r.body, { ok: true });
  assert.match(r.h['set-cookie'], /Max-Age=0/);
  assert.ok(banco.consultas.some(c => /delete from usuarios where id/.test(c.texto)));
  assert.ok(blob.apagados.length && blob.apagados.every(u => u.includes('/capas/u1/')), 'só apaga arquivos do próprio usuário');
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

/* ---------- capas: cota ---------- */
test('capa: respeita a cota por hora e por total, e registra o envio', async () => {
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_teste';
  const imagem = 'data:image/jpeg;base64,/9j/4AAQ';
  banco.resposta = base(t => (/from capas where user_id/.test(t) ? [{ hora: 30, total: 30 }] : []));
  assert.equal((await chamar('capa', { logado: true, body: { imagem } })).code, 429);
  banco.resposta = base(t => (/from capas where user_id/.test(t) ? [{ hora: 0, total: 1000 }] : []));
  assert.equal((await chamar('capa', { logado: true, body: { imagem } })).code, 429);
  limpar(); banco.resposta = base(t => (/from capas where user_id/.test(t) ? [{ hora: 1, total: 5 }] : []));
  const r = await chamar('capa', { logado: true, body: { imagem } });
  assert.equal(r.code, 200); assert.match(r.body.url, /capas\/u1\/capa\.jpg$/);
  assert.ok(banco.consultas.some(c => /insert into capas/.test(c.texto) && c.vals.includes(r.body.url)));
  assert.equal((await chamar('capa', { logado: true, body: { imagem: 'data:text/html;base64,AAAA' } })).code, 400);
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

/* ---------- cron ---------- */
test('cron: exige o CRON_SECRET e devolve o que limpou', async () => {
  process.env.CRON_SECRET = 'segredo-do-cron';
  banco.resposta = base(t => (/with d as \(delete/.test(t) ? [{ n: 3 }] : []));
  assert.equal((await chamar('cron', { metodo: 'GET' })).code, 401);
  assert.equal((await chamar('cron', { metodo: 'GET', headers: { authorization: 'Bearer errado' } })).code, 401);
  const r = await chamar('cron', { metodo: 'GET', headers: { authorization: 'Bearer segredo-do-cron' } });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body, { ok: true, tentativas: 3, links: 3, capasBlob: 0, capasRegistro: 3 });
  delete process.env.CRON_SECRET;
  assert.equal((await chamar('cron', { metodo: 'GET', headers: { authorization: 'Bearer x' } })).code, 500);
});
