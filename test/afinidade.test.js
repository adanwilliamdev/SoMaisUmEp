// Radar de afinidade (backend): DNA das sementes, motivos de cada candidato e o endpoint com TMDb falso.
process.env.SESSION_SECRET = 'segredo-de-teste-segredo-de-teste';
process.env.DATABASE_URL = 'postgresql://x:y@localhost/z';
process.env.TMDB_READ_TOKEN = 'eyJ' + 'a'.repeat(80);

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const banco = { resposta: () => [] };
const falsos = {
  '@neondatabase/serverless': {
    neon: () => {
      const sql = (strings, ...vals) => Promise.resolve(banco.resposta(strings.join('?').replace(/\s+/g, ' ').trim(), vals));
      sql.transaction = qs => Promise.all(qs);
      return sql;
    },
  },
};
const carregarMod = Module._load;
Module._load = function (req, ...resto) {
  return falsos[req] || carregarMod.call(this, req, ...resto);
};

const { assinar } = require('../api/_lib');
const A = require('../api/_afinidade');

const USER = { id: 'u1', nome: 'Ana', email: 'ana@exemplo.com', versao: 1 };
const cookie = () => {
  const v = `${USER.id}.${USER.versao}.${Date.now() + 864e5}`;
  return `sessao=${v}.${assinar(v)}`;
};
const novoRes = () => ({
  h: {},
  code: 200,
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
  send(b) {
    this.body = b;
    return this;
  },
  end() {
    return this;
  },
});
const tmdb = { chamadas: [], rotas: {} };
global.fetch = async url => {
  const u = new URL(url),
    chave = u.pathname.replace('/3', '');
  tmdb.chamadas.push(chave + u.search);
  const r = tmdb.rotas[chave];
  if (r === undefined) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => r };
};

const gen = (...n) => n.map((nome, i) => ({ id: i + 1, name: nome }));
const pessoa = (id, name, job) => ({ id, name, job });

test('perfilDe: criadores e diretores viram "direção"; elenco limitado a 5', () => {
  const p = A.perfilDe({
    created_by: [{ id: 1, name: 'Criadora' }],
    genres: gen('Drama'),
    credits: { crew: [pessoa(2, 'Diretor', 'Director'), pessoa(3, 'Editor', 'Editor')], cast: Array.from({ length: 8 }, (_, i) => ({ id: 100 + i, name: 'A' + i })) },
  });
  assert.deepEqual([...p.dirs.values()], ['Criadora', 'Diretor']);
  assert.equal(p.atores.size, 5);
  assert.deepEqual([...p.generos.values()], ['Drama']);
});

test('dnaDe: só o que se repete em 2+ sementes', () => {
  const s = (id, d, a, g) => ({ id, peso: 1, perfil: A.perfilDe({ created_by: d, genres: g, credits: { cast: a } }) });
  const dna = A.dnaDe([
    s(1, [{ id: 1, name: 'Nolan' }], [{ id: 9, name: 'Ator' }], gen('Drama', 'Crime')),
    s(2, [{ id: 1, name: 'Nolan' }], [{ id: 8, name: 'Outro' }], gen('Drama')),
  ]);
  assert.deepEqual(dna.diretores, [{ nome: 'Nolan', n: 2 }]);
  assert.deepEqual(dna.atores, []);
  assert.deepEqual(dna.generos, [{ nome: 'Drama', n: 2 }]);
});

test('pontuar: mesma direção pesa mais que indicação; sem motivo, fora; um motivo por semente', () => {
  const sem = [{ id: 1, peso: 1, perfil: A.perfilDe({ created_by: [{ id: 7, name: 'Dir' }], genres: gen('Drama', 'Crime') }) }];
  const c = (id, extra, recomendadoPor = []) => ({ resumo: { id, nome: 'N' + id }, recomendadoPor, onde: ['Netflix'], perfil: A.perfilDe(extra) });
  const r = A.pontuar(sem, [
    c(10, { genres: gen('Comédia') }, [1]), // só indicado
    c(11, { created_by: [{ id: 7, name: 'Dir' }], genres: gen('Drama', 'Crime') }, [1]), // mesma direção + indicado
    c(12, { genres: gen('Terror') }), // nada
  ]);
  assert.deepEqual(
    r.map(x => x.id),
    [11, 10],
  );
  assert.deepEqual(r[0].porque, [{ tipo: 'dir', seed: 1, nome: 'Dir' }]);
  assert.deepEqual(r[1].porque, [{ tipo: 'rec', seed: 1 }]);
  assert.deepEqual(r[0].onde, ['Netflix']);
});

test('ondeCurto: até 2 serviços do Brasil (assinatura ou grátis)', () => {
  const d = { 'watch/providers': { results: { BR: { flatrate: [{ provider_name: 'A' }, { provider_name: 'B' }], free: [{ provider_name: 'C' }] }, US: { flatrate: [{ provider_name: 'Z' }] } } } };
  assert.deepEqual(A.ondeCurto(d), ['A', 'B']);
  assert.deepEqual(A.ondeCurto({}), []);
});

test('/api/tmdb afinidade: DNA, motivos e onde assistir; valida ids; falha geral dá 502', async () => {
  banco.resposta = t => (/from usuarios/.test(t) ? [USER] : /insert into tentativas/.test(t) ? [{ falhas: 1 }] : []);
  const chamar = async query => {
    const res = novoRes();
    await require('../api/tmdb')({ method: 'GET', query, headers: { cookie: cookie() } }, res);
    return res;
  };
  const rec = id => ({ id, name: 'S' + id, first_air_date: '2020-01-01', popularity: 1 });
  tmdb.rotas = {
    '/tv/1': { id: 1, genres: gen('Drama'), created_by: [{ id: 5, name: 'Criador' }], credits: { cast: [], crew: [] }, recommendations: { results: [rec(10), rec(11)] } },
    '/tv/2': { id: 2, genres: gen('Drama'), created_by: [{ id: 5, name: 'Criador' }], credits: { cast: [], crew: [] }, recommendations: { results: [rec(10)] } },
    '/tv/10': { id: 10, genres: gen('Drama'), created_by: [{ id: 5, name: 'Criador' }], credits: {}, 'watch/providers': { results: { BR: { flatrate: [{ provider_name: 'Max' }] } } } },
    '/tv/11': { id: 11, genres: gen('Ação'), credits: {} },
  };
  const r = await chamar({ acao: 'afinidade', tipo: 'tv', ids: '1:10,2:8.5,abc,1:10' });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.dna.diretores, [{ nome: 'Criador', n: 2 }]);
  assert.equal(r.body.resultados[0].id, 10);
  assert.deepEqual(r.body.resultados[0].onde, ['Max']);
  assert.equal(r.body.resultados[0].porque[0].tipo, 'dir');
  assert.match(r.h['cache-control'], /s-maxage=21600/);
  assert.equal((await chamar({ acao: 'afinidade', tipo: 'tv', ids: 'x' })).code, 400);
  tmdb.rotas = {};
  assert.equal((await chamar({ acao: 'afinidade', tipo: 'tv', ids: '1,2' })).code, 502);
});

test('top: a nota de rodapé passa pelo validador (limite e tipo)', () => {
  const V = require('../api/_validar');
  const t = V.top({ id: 'a', nome: 'T', itens: [{ t: 'A', obs: '  boa maratona  ' }, { t: 'B', obs: 'y'.repeat(999) }, { t: 'C', obs: { x: 1 } }, { t: 'D' }] });
  assert.equal(t.itens[0].obs, 'boa maratona');
  assert.equal(t.itens[1].obs.length, V.OBS_MAX);
  assert.equal(t.itens[2].obs, undefined);
  assert.equal(t.itens[3].obs, undefined);
});
