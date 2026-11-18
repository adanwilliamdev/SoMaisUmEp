// Testes contra um Postgres de verdade: o que o banco falso dos testes comuns não consegue provar (SQL, restrições, `on conflict`,
// `unnest`, jsonb, cascata, limite de tentativas). Rode com um banco VAZIO e DESCARTÁVEL (o teste apaga tudo nele):
//
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/somaisumep_test npm run test:integracao
//
// Sem TEST_DATABASE_URL os testes são ignorados. Por segurança, só aceita um banco cujo nome contenha "test".
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const ALVO = process.env.TEST_DATABASE_URL;
const PULAR = ALVO ? false : 'defina TEST_DATABASE_URL (um Postgres vazio de teste) para rodar a integração';
if (ALVO && !/test/i.test(decodeURIComponent(new URL(ALVO).pathname))) {
  throw new Error('TEST_DATABASE_URL precisa apontar para um banco com "test" no nome: este teste apaga todas as tabelas.');
}

process.env.SESSION_SECRET = 'segredo-de-teste-segredo-de-teste';
process.env.DATABASE_URL = ALVO || 'postgresql://sem-banco/test';
delete process.env.BLOB_READ_WRITE_TOKEN;

let pool, assinar, hashSenha;
const M = require('../scripts/migrar');

before(async () => {
  if (PULAR) return;
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: ALVO, max: 4 });
  require('./pg-como-neon').instalar(pool);
  ({ assinar, hashSenha } = require('../api/_lib'));
  await pool.query('drop schema public cascade; create schema public');
  for (const arq of M.listar()) for (const c of M.comandos(M.ler(arq))) await pool.query(c); // migrações em ordem, como em produção
});
after(async () => {
  if (pool) await pool.end();
});

/* ---------- ajudantes ---------- */
const novoRes = () => ({
  h: {},
  code: 200,
  body: undefined,
  setHeader(k, v) {
    this.h[k.toLowerCase()] = v;
  },
  status(c) {
    this.code = c;
    return this;
  },
  json(b) {
    this.body = b;
    return this;
  },
  end() {
    return this;
  },
});
const cookieDe = u => {
  const v = `${u.id}.${u.versao || 1}.${Date.now() + 864e5}`;
  return `sessao=${v}.${assinar(v)}`;
};
async function chamar(arquivo, { metodo = 'POST', body, query = {}, headers = {}, como = null } = {}) {
  const res = novoRes();
  await require('../api/' + arquivo)({ method: metodo, body, query, headers: { ...(como ? { cookie: cookieDe(como) } : {}), ...headers } }, res);
  return res;
}
let contador = 0;
async function criarUsuario(hash) {
  const n = ++contador,
    u = { id: 'u' + n + '-' + crypto.randomUUID().slice(0, 8), nome: 'Ana ' + n, email: `ana${n}-${crypto.randomUUID().slice(0, 6)}@exemplo.com`, versao: 1 };
  await pool.query('insert into usuarios (id, email, nome, senha_hash) values ($1, $2, $3, $4)', [u.id, u.email, u.nome, hash || (await hashSenha('senha-certa-1'))]);
  return u;
}
const titulo = (id, extra = {}) => ({ id, tipo: 'tv', nome: 'Série ' + id, eps: [5], vis: [0], criado: 1, hist: {}, base: null, ...extra });
const sync = (u, corpo) => chamar('_h/sync', { como: u, body: corpo });
const linha = async (u, id) => (await pool.query('select * from titulos where user_id = $1 and id = $2', [u.id, id])).rows[0];

/* ---------- esquema ---------- */
test('esquema: neon/schema.sql (o que o README manda colar no Neon) roda do zero e cria as mesmas tabelas das migrações', { skip: PULAR }, async () => {
  const cli = await pool.connect();
  try {
    await cli.query('create schema aux_schema; set search_path to aux_schema');
    await cli.query(M.schemaCompleto());
    const tabelas = a => cli.query("select table_name from information_schema.tables where table_schema = $1 order by 1", [a]).then(r => r.rows.map(x => x.table_name));
    assert.deepEqual(await tabelas('aux_schema'), await tabelas('public'));
  } finally {
    await cli.query('set search_path to public; drop schema if exists aux_schema cascade').catch(() => {});
    cli.release();
  }
});

/* ---------- sincronização e controle de versão ---------- */
test('sync: título novo (sem base) é criado e volta com a versão; /api/dados devolve o que foi salvo', { skip: PULAR }, async () => {
  const u = await criarUsuario();
  const r = await sync(u, { titulos: [titulo('a1', { vis: [2], hist: { '2026-11': 2 }, proximo: { d: '2026-12-01', t: 1, e: 3 } })] });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.conflitos, []);
  assert.ok(Number(r.body.versoes.a1) > 0);
  const d = await chamar('dados', { metodo: 'GET', como: u });
  assert.equal(d.body.series.length, 1);
  assert.deepEqual(d.body.series[0].vis, [2]);
  assert.deepEqual(d.body.series[0].hist, { '2026-11': 2 });
  assert.equal(Number(d.body.series[0].atualizado), Number(r.body.versoes.a1));
});

test('sync: linha que já existe chegando SEM base vira conflito e não é sobrescrita (null nunca é igual a versão nenhuma)', { skip: PULAR }, async () => {
  const u = await criarUsuario();
  await sync(u, { titulos: [titulo('a1', { nome: 'Original' })] });
  const r = await sync(u, { titulos: [titulo('a1', { nome: 'Invasor', base: null })] });
  assert.deepEqual(r.body.conflitos, ['a1']);
  assert.equal((await linha(u, 'a1')).nome, 'Original');
});

test('sync: base velha é conflito; base atual atualiza e a versão sobe', { skip: PULAR }, async () => {
  const u = await criarUsuario();
  const v1 = Number((await sync(u, { titulos: [titulo('a1')] })).body.versoes.a1);
  const ok = await sync(u, { titulos: [titulo('a1', { vis: [3], base: v1 })] });
  assert.deepEqual(ok.body.conflitos, []);
  const v2 = Number(ok.body.versoes.a1);
  assert.ok(v2 > v1, 'a versão avança a cada gravação');
  assert.deepEqual((await linha(u, 'a1')).vis, [3]);
  const velho = await sync(u, { titulos: [titulo('a1', { vis: [5], base: v1 })] });
  assert.deepEqual(velho.body.conflitos, ['a1']);
  assert.deepEqual((await linha(u, 'a1')).vis, [3], 'a versão velha não sobrescreve');
});

test('sync: tops seguem a mesma regra (jsonb incluído)', { skip: PULAR }, async () => {
  const u = await criarUsuario();
  const top = (extra = {}) => ({ id: 'p1', nome: 'Meu top', itens: [{ t: 'Dark & "x"', sid: null, obs: 'nota' }], criado: 1, base: null, ...extra });
  const v1 = Number((await sync(u, { tops: [top()] })).body.versoes.p1);
  assert.deepEqual((await sync(u, { tops: [top({ nome: 'Sem base' })] })).body.conflitos, ['p1']);
  assert.equal((await sync(u, { tops: [top({ nome: 'Novo nome', base: v1 })] })).body.conflitos.length, 0);
  const { rows } = await pool.query('select nome, itens from tops where user_id = $1 and id = $2', [u.id, 'p1']);
  assert.equal(rows[0].nome, 'Novo nome');
  assert.deepEqual(rows[0].itens[0], { t: 'Dark & "x"', sid: null, obs: 'nota' });
});

test('sync: exclusão só vale com a base atual; sem base ou com base velha a linha fica', { skip: PULAR }, async () => {
  const u = await criarUsuario();
  const v1 = Number((await sync(u, { titulos: [titulo('a1'), titulo('a2')] })).body.versoes.a1);
  const v2 = Number((await sync(u, { titulos: [titulo('a1', { vis: [1], base: v1 })] })).body.versoes.a1);
  const r = await sync(u, { del: { titulos: [{ id: 'a1', base: v1 }, 'a2'], tops: [] } }); // base velha; id solto (sem base)
  assert.deepEqual([...r.body.conflitos].sort(), ['a1', 'a2']);
  assert.ok(await linha(u, 'a1') && (await linha(u, 'a2')), 'nada foi apagado');
  const ok = await sync(u, { del: { titulos: [{ id: 'a1', base: v2 }], tops: [] } });
  assert.deepEqual(ok.body.conflitos, []);
  assert.equal(await linha(u, 'a1'), undefined, 'com a base atual apaga');
});

test('sync: contas são isoladas (mesmo id em outra conta não colide e ninguém mexe no que não é seu)', { skip: PULAR }, async () => {
  const a = await criarUsuario(),
    b = await criarUsuario();
  const va = Number((await sync(a, { titulos: [titulo('mesmo', { nome: 'da Ana' })] })).body.versoes.mesmo);
  const rb = await sync(b, { titulos: [titulo('mesmo', { nome: 'do Beto' })] });
  assert.deepEqual(rb.body.conflitos, [], 'o Beto cria o dele, não colide com o da Ana');
  assert.equal((await linha(a, 'mesmo')).nome, 'da Ana');
  assert.equal((await linha(b, 'mesmo')).nome, 'do Beto');
  const apaga = await sync(b, { del: { titulos: [{ id: 'mesmo', base: va }], tops: [] } }); // base da Ana nunca serve para a linha do Beto
  assert.deepEqual(apaga.body.conflitos, ['mesmo']);
  assert.ok(await linha(b, 'mesmo') && (await linha(a, 'mesmo')));
});

test('dados: ETag igual devolve 304; ?desde= traz só o que mudou', { skip: PULAR }, async () => {
  const u = await criarUsuario();
  const v1 = Number((await sync(u, { titulos: [titulo('a1'), titulo('a2')] })).body.versoes.a1);
  const cheio = await chamar('dados', { metodo: 'GET', como: u });
  assert.equal(cheio.body.series.length, 2);
  const etag = cheio.h.etag;
  assert.ok(etag);
  assert.equal((await chamar('dados', { metodo: 'GET', como: u, headers: { 'if-none-match': etag } })).code, 304);
  const v3 = Number((await sync(u, { titulos: [titulo('a2', { vis: [1], base: v1 + 1 })] })).body.versoes.a2);
  const inc = await chamar('dados', { metodo: 'GET', como: u, query: { desde: String(v3) } });
  assert.deepEqual(inc.body.series.map(s => s.id), ['a2']);
});

/* ---------- contas, senha e limites ---------- */
test('cadastro e login de ponta a ponta: o hash guardado já tem o custo atual; e-mail repetido dá 409 (índice único)', { skip: PULAR }, async () => {
  const email = `novo-${crypto.randomUUID().slice(0, 6)}@exemplo.com`;
  const ip = { 'x-forwarded-for': '10.1.1.' + Math.floor(Math.random() * 200) };
  const c = await chamar('_h/cadastro', { body: { nome: 'Nova', email, senha: 'senha-bem-longa' }, headers: ip });
  assert.equal(c.code, 200);
  const { rows } = await pool.query('select senha_hash from usuarios where email = $1', [email]);
  assert.match(rows[0].senha_hash, /^scrypt\$131072\$8\$1\$/);
  assert.equal((await chamar('_h/login', { body: { email, senha: 'senha-bem-longa' }, headers: ip })).code, 200);
  assert.equal((await chamar('_h/cadastro', { body: { nome: 'Outra', email, senha: 'senha-bem-longa' }, headers: ip })).code, 409);
});

test('login: hash do formato legado é regravado com o custo atual, sem derrubar as outras sessões (versao igual)', { skip: PULAR }, async () => {
  const salt = crypto.randomBytes(16);
  const legado = `scrypt$${salt.toString('hex')}$${crypto.scryptSync('senha-antiga-1', salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')}`;
  const u = await criarUsuario(legado);
  const r = await chamar('_h/login', { body: { email: u.email, senha: 'senha-antiga-1' }, headers: { 'x-forwarded-for': '10.2.2.2' } });
  assert.equal(r.code, 200);
  const { rows } = await pool.query('select senha_hash, versao from usuarios where id = $1', [u.id]);
  assert.match(rows[0].senha_hash, /^scrypt\$131072\$8\$1\$/);
  assert.equal(rows[0].versao, 1);
  assert.equal((await chamar('_h/login', { body: { email: u.email, senha: 'senha-antiga-1' }, headers: { 'x-forwarded-for': '10.2.2.2' } })).code, 200, 'a mesma senha segue valendo');
});

test('login: errar a senha em sequência bloqueia (429) usando a tabela `tentativas` de verdade; acertar limpa o contador', { skip: PULAR }, async () => {
  const u = await criarUsuario();
  const h = { 'x-forwarded-for': '10.3.3.3' };
  const codigos = [];
  for (let i = 0; i < 8; i++) codigos.push((await chamar('_h/login', { body: { email: u.email, senha: 'errada' }, headers: h })).code);
  assert.deepEqual(codigos.slice(0, 5), [401, 401, 401, 401, 401]);
  assert.ok(codigos.includes(429), 'bloqueou: ' + codigos);
  const { rows } = await pool.query("select falhas, ate from tentativas where chave like 'em:%' and ate > $1", [Date.now()]);
  assert.ok(rows.length >= 1);
  const outro = await criarUsuario();
  await chamar('_h/login', { body: { email: outro.email, senha: 'errada' }, headers: { 'x-forwarded-for': '10.3.3.4' } });
  assert.equal((await chamar('_h/login', { body: { email: outro.email, senha: 'senha-certa-1' }, headers: { 'x-forwarded-for': '10.3.3.4' } })).code, 200);
});

test('conta: excluir apaga a conta e, em cascata, títulos, tops e capas', { skip: PULAR }, async () => {
  const u = await criarUsuario();
  await sync(u, { titulos: [titulo('a1')], tops: [{ id: 'p1', nome: 'Top', itens: [], criado: 1, base: null }] });
  const r = await chamar('_h/conta', { como: u, body: { acao: 'excluir', senha: 'senha-certa-1' } });
  assert.equal(r.code, 200);
  for (const t of ['usuarios', 'titulos', 'tops', 'capas']) {
    const col = t === 'usuarios' ? 'id' : 'user_id';
    assert.equal((await pool.query(`select count(*)::int as n from ${t} where ${col} = $1`, [u.id])).rows[0].n, 0, t);
  }
});
