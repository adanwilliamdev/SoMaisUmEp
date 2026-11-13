// Roteador dos endpoints que dividem um arquivo (api/t.js e api/tmdb.js) e o limite de funções do plano Hobby.
process.env.SESSION_SECRET = 'segredo-de-teste-segredo-de-teste';
process.env.DATABASE_URL = 'postgresql://x:y@localhost/z';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const USER = { id: 'u1', nome: 'Ana', email: 'ana@exemplo.com', versao: 1 };
const carregarMod = Module._load;
Module._load = function (req, ...resto) {
  if (req === '@neondatabase/serverless') return { neon: () => strings => Promise.resolve(/from usuarios/.test(strings.join('?')) ? [USER] : []) };
  return carregarMod.call(this, req, ...resto);
};

const { roteador } = require('../api/_roteador');
const { assinar } = require('../api/_lib');

const cookie = () => {
  const v = `${USER.id}.${USER.versao}.${Date.now() + 864e5}`;
  return `sessao=${v}.${assinar(v)}`;
};

const novoRes = () => {
  const h = {};
  return {
    h,
    code: 200,
    body: undefined,
    setHeader(k, v) {
      h[k.toLowerCase()] = v;
    },
    status(c) {
      this.code = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    send(b) {
      this.body = b;
      return this;
    },
    end() {
      return this;
    },
  };
};

test('roteador: escolhe pelo método e responde 405 (com Allow) para os outros', async () => {
  const visto = [];
  const r = roteador({
    GET: (req, res) => visto.push('get'),
    POST: (req, res) => visto.push('post'),
  });
  await r({ method: 'GET' }, novoRes());
  await r({ method: 'POST' }, novoRes());
  assert.deepEqual(visto, ['get', 'post']);
  for (const metodo of ['PUT', 'DELETE', 'PATCH', 'constructor', '__proto__']) {
    const res = novoRes();
    await r({ method: metodo }, res);
    assert.equal(res.code, 405, metodo);
    assert.equal(res.h.allow, 'GET, POST');
    assert.deepEqual(res.body, { erro: 'Método não permitido' });
  }
  assert.equal(visto.length, 2);
});

test('/api/t: só GET (página) e POST (link); outros métodos dão 405', async () => {
  const t = require('../api/t');
  for (const metodo of ['PUT', 'DELETE']) {
    const res = novoRes();
    await t({ method: metodo, query: {}, headers: {} }, res);
    assert.equal(res.code, 405);
  }
  const res = novoRes();
  await t({ method: 'GET', query: { c: 'curto' }, headers: {} }, res);
  assert.equal(res.code, 404, 'GET com código inválido: página "Top não encontrado"');
  assert.match(String(res.body), /Top não encontrado/);
  const post = novoRes();
  await t({ method: 'POST', body: {}, headers: {} }, post);
  assert.equal(post.code, 401, 'POST sem login é recusado pelo handler de compartilhar');
});

test('/api/tmdb: GET valida tipo e ação; POST vai para a importação; outros métodos dão 405', async () => {
  const tmdb = require('../api/tmdb');
  const chamar = async (metodo, extra = {}, logado = true) => {
    const res = novoRes();
    await tmdb({ method: metodo, query: {}, headers: logado ? { cookie: cookie() } : {}, ...extra }, res);
    return res;
  };
  assert.equal((await chamar('GET', { query: { acao: 'busca', tipo: 'tv' } }, false)).code, 401, 'sem login nada passa');
  assert.deepEqual((await chamar('GET', { query: { acao: 'busca', tipo: 'x' } })).body, { erro: 'Tipo inválido' });
  assert.deepEqual((await chamar('GET', { query: { acao: 'nada', tipo: 'tv' } })).body, { erro: 'Ação inválida' });
  assert.deepEqual((await chamar('GET', { query: { acao: 'constructor', tipo: 'tv' } })).body, { erro: 'Ação inválida' });
  assert.deepEqual((await chamar('GET', { query: { acao: 'detalhe', tipo: 'tv', id: 'abc' } })).body, { erro: 'Ação inválida' });
  assert.deepEqual((await chamar('GET', { query: { acao: 'busca', tipo: 'tv', q: '  ' } })).body, { erro: 'Digite um nome para buscar' });
  assert.deepEqual((await chamar('GET', { query: { acao: 'parecidos', tipo: 'tv', ids: 'x' } })).body, { erro: 'Informe títulos do TMDb' });
  assert.deepEqual((await chamar('POST', { body: { itens: [] } })).body, { erro: 'Nada para importar' }, 'POST é a importação em lote');
  assert.equal((await chamar('POST', { body: { itens: [] } }, false)).code, 401);
  assert.equal((await chamar('PUT')).code, 405);
});

test('tabela de consultas do TMDb: as ações conhecidas existem e nomes herdados do Object não valem', () => {
  const { consultas } = require('../api/_consultas');
  assert.deepEqual(Object.keys(consultas).sort(), ['afinidade', 'busca', 'detalhe', 'parecidos', 'streaming', 'tendencias']);
  assert.equal(Object.hasOwn(consultas, 'constructor'), false);
});

test('plano Hobby: no máximo 12 arquivos públicos em api/ (os que não começam com _)', () => {
  const publicos = fs.readdirSync(path.join(__dirname, '..', 'api')).filter(f => f.endsWith('.js') && !f.startsWith('_'));
  assert.ok(publicos.length <= 12, `api/ tem ${publicos.length} funções: ${publicos.join(', ')}`);
});
