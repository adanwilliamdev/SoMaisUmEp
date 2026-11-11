// Testes do backend: próximo lançamento, descobrir, importação, link público de tops e página /t/<código>.
// Banco e TMDb são falsos (nada de rede); o que se confere é a lógica dos endpoints.
process.env.SESSION_SECRET = 'segredo-de-teste-segredo-de-teste';
process.env.DATABASE_URL = 'postgresql://x:y@localhost/z';
process.env.TMDB_READ_TOKEN = 'eyJ' + 'a'.repeat(80);

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const banco = { consultas: [], resposta: () => [] };
const falsos = {
  '@neondatabase/serverless': {
    neon: () => {
      const sql = (strings, ...vals) => {
        const texto = strings.join('?').replace(/\s+/g, ' ').trim();
        banco.consultas.push({ texto, vals });
        try {
          return Promise.resolve(banco.resposta(texto, vals));
        } catch (e) {
          return Promise.reject(e);
        }
      };
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
const V = require('../api/_validar');
const T = require('../api/_tmdb');

const USER = { id: 'u1', nome: 'Ana Souza', email: 'ana@exemplo.com', versao: 1 };
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
async function chamar(arquivo, { metodo = 'GET', body, query = {}, logado = true } = {}) {
  const res = novoRes();
  await require('../api/' + arquivo)({ method: metodo, body, query, headers: logado ? { cookie: cookie() } : {} }, res);
  return res;
}
const base = extra => (t, v) => {
  if (/select id, nome, email, versao from usuarios/.test(t)) return [USER];
  if (/select ate from tentativas/.test(t)) return []; // nunca bloqueado
  if (/insert into tentativas/.test(t)) return [{ falhas: 1 }];
  return extra ? extra(t, v) || [] : [];
};

// TMDb falso: rotas -> resposta; registra as chamadas.
const tmdb = { chamadas: [], rotas: {} };
global.fetch = async url => {
  const u = new URL(url),
    chave = u.pathname.replace('/3', '');
  tmdb.chamadas.push(chave + u.search);
  const r = tmdb.rotas[chave];
  if (r === undefined) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => (typeof r === 'function' ? r(u) : r) };
};

/* ---------- validação ---------- */
test('proximo: só data válida; temporada e episódio opcionais', () => {
  assert.deepEqual(V.proximo({ d: '2026-11-06', t: 3, e: 1 }), { d: '2026-11-06', t: 3, e: 1 });
  assert.deepEqual(V.proximo({ d: '2026-11-06' }), { d: '2026-11-06' });
  assert.deepEqual(V.proximo({ d: '2026-11-06', t: 'x', e: -4 }), { d: '2026-11-06', e: 1 });
  assert.equal(V.proximo({ d: '2026-13-06' }), null);
  assert.equal(V.proximo({ d: '06/11/2026' }), null);
  assert.equal(V.proximo(null), null);
  assert.equal(V.proximo('2026-11-06'), null);
  assert.deepEqual(V.titulo({ id: 'a', nome: 'S', eps: [3], vis: [0], proximo: { d: '2026-11-06', t: 1 } }, 'u1').proximo, { d: '2026-11-06', t: 1 });
  assert.equal(V.titulo({ id: 'a', nome: 'S', eps: [3], vis: [0] }, 'u1').proximo, null);
});

/* ---------- TMDb: próximo episódio e detalhe ---------- */
test('detalhe: próximo episódio da série, estreia futura do filme e números das temporadas', () => {
  const tv = T.detalheDe(
    {
      id: 1,
      name: 'S',
      first_air_date: '2020-01-01',
      seasons: [
        { season_number: 0, episode_count: 2 },
        { season_number: 1, episode_count: 8 },
        { season_number: 3, episode_count: 6 },
        { season_number: 4, episode_count: 0 },
      ],
      next_episode_to_air: { air_date: '2026-11-06', season_number: 3, episode_number: 2 },
    },
    'tv',
  );
  assert.deepEqual(tv.eps, [8, 6]);
  assert.deepEqual(tv.nums, [1, 3]);
  assert.deepEqual(tv.proximo, { d: '2026-11-06', t: 3, e: 2 });
  assert.equal(T.detalheDe({ id: 1, name: 'S', seasons: [], next_episode_to_air: null }, 'tv').proximo, null);
  assert.equal(T.detalheDe({ id: 1, name: 'S', seasons: [], next_episode_to_air: { air_date: null } }, 'tv').proximo, null);
  assert.deepEqual(T.proximoDe({ release_date: '2026-12-25' }, 'movie', '2026-11-04'), { d: '2026-12-25' });
  assert.equal(T.proximoDe({ release_date: '2020-01-01' }, 'movie', '2026-11-04'), null);
  assert.deepEqual(T.proximoDe({ release_date: '2026-11-04' }, 'movie', '2026-11-04'), { d: '2026-11-04' });
});

test('/api/tmdb detalhe: cache de 6 h para séries', async () => {
  banco.resposta = base();
  tmdb.rotas = {
    '/tv/10': {
      id: 10,
      name: 'S',
      seasons: [{ season_number: 1, episode_count: 3 }],
      next_episode_to_air: { air_date: '2026-11-06', season_number: 1, episode_number: 2 },
    },
  };
  const r = await chamar('tmdb', { query: { acao: 'detalhe', tipo: 'tv', id: '10' } });
  assert.equal(r.body.proximo.d, '2026-11-06');
  assert.match(r.h['cache-control'], /s-maxage=21600/);
});

/* ---------- descobrir ---------- */
test('/api/tmdb tendencias: lista resumida', async () => {
  banco.resposta = base();
  tmdb.rotas = {
    '/trending/movie/week': {
      results: Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        title: 'F' + i,
        release_date: '2026-01-01',
        poster_path: '/p.jpg',
        vote_average: 7.26,
        overview: 'x'.repeat(500),
      })),
    },
  };
  const r = await chamar('tmdb', { query: { acao: 'tendencias', tipo: 'movie' } });
  assert.equal(r.body.resultados.length, 18);
  assert.deepEqual(
    [r.body.resultados[0].nome, r.body.resultados[0].ano, r.body.resultados[0].nota, r.body.resultados[0].poster],
    ['F0', '2026', 7.3, 'https://image.tmdb.org/t/p/w342/p.jpg'],
  );
  assert.equal(r.body.resultados[0].sinopse.length, 300);
  assert.equal((await chamar('tmdb', { query: { acao: 'tendencias', tipo: 'movie' }, logado: false })).code, 401);
});

test('/api/tmdb parecidos: mais indicações primeiro, sem o título de origem, e tolera falha parcial', async () => {
  banco.resposta = base();
  tmdb.chamadas = [];
  const it = (id, pop) => ({ id, name: 'S' + id, first_air_date: '2020-01-01', popularity: pop });
  tmdb.rotas = {
    '/tv/1/recommendations': { results: [it(10, 5), it(11, 50), it(2, 99)] },
    '/tv/2/recommendations': { results: [it(10, 5), it(12, 1)] },
    // /tv/3 não existe: 404
  };
  const r = await chamar('tmdb', { query: { acao: 'parecidos', tipo: 'tv', ids: '1,2,3,abc,1' } });
  assert.deepEqual(
    r.body.resultados.map(x => x.id),
    [10, 11, 12],
  ); // 10 é indicado por 1 e 2; 2 é semente de origem
  assert.deepEqual(r.body.resultados[0].porque, [1, 2]);
  assert.equal(tmdb.chamadas.filter(c => c.includes('recommendations')).length, 3); // ids repetidos/ inválidos não geram chamada
  assert.equal((await chamar('tmdb', { query: { acao: 'parecidos', tipo: 'tv', ids: 'abc' } })).code, 400);
  tmdb.rotas = {};
  assert.equal((await chamar('tmdb', { query: { acao: 'parecidos', tipo: 'tv', ids: '1,2' } })).code, 502);
});

/* ---------- importar ---------- */
test('/api/importar: resolve por id do TMDb, id do IMDb e nome+ano; falhas não derrubam o lote', async () => {
  banco.resposta = base();
  tmdb.chamadas = [];
  tmdb.rotas = {
    '/movie/380': { id: 380, title: 'Rain Man', release_date: '1988-12-16', runtime: 133 },
    '/find/tt0110912': { movie_results: [{ id: 680 }] },
    '/movie/680': { id: 680, title: 'Pulp Fiction', release_date: '1994-09-10' },
    '/search/movie': u => ({
      results: [
        { id: 5, title: 'Remake', release_date: '2010-01-01' },
        { id: 496243, title: 'Parasita', release_date: '2019-05-30' },
      ],
    }),
    '/movie/496243': { id: 496243, title: 'Parasita', release_date: '2019-05-30' },
    '/search/tv': { results: [] },
  };
  const r = await chamar('tmdb', {
    metodo: 'POST',
    body: {
      itens: [
        { tipo: 'movie', tmdb: '380', nome: 'ignorado' },
        { tipo: 'movie', imdb: 'tt0110912' },
        { tipo: 'movie', nome: 'Parasita', ano: '2019' },
        { tipo: 'tv', nome: 'Série que não existe', ano: '2001' },
        { tipo: 'movie', imdb: 'tt1', nome: '' },
      ],
    },
  });
  const x = r.body.resultados;
  assert.deepEqual(
    x.map(i => i.ok),
    [true, true, true, false, false],
  );
  assert.deepEqual([x[0].nome, x[0].duracao, x[1].tmdb, x[2].tmdb], ['Rain Man', 133, 680, 496243]);
  assert.match(x[3].erro, /Não encontrado/);
  assert.ok(tmdb.chamadas.some(c => c.startsWith('/search/movie') && c.includes('year=2019')));
});

test('/api/importar: exige login, limita o lote a 10 e recusa lote vazio', async () => {
  banco.resposta = base();
  tmdb.rotas = { '/movie/1': { id: 1, title: 'F' } };
  assert.equal((await chamar('tmdb', { metodo: 'POST', body: { itens: [{ tipo: 'movie', tmdb: '1' }] }, logado: false })).code, 401);
  assert.equal((await chamar('tmdb', { metodo: 'POST', body: { itens: [] } })).code, 400);
  const r = await chamar('tmdb', { metodo: 'POST', body: { itens: Array.from({ length: 30 }, () => ({ tipo: 'movie', tmdb: '1' })) } });
  assert.equal(r.body.resultados.length, 10);
});

test('/api/importar: limite por hora por conta (400 lotes) devolve 429 sem chamar o TMDb', async () => {
  tmdb.chamadas = [];
  tmdb.rotas = { '/movie/1': { id: 1, title: 'F' } };
  banco.consultas = [];
  banco.resposta = base();
  const ok = await chamar('tmdb', { metodo: 'POST', body: { itens: [{ tipo: 'movie', tmdb: '1' }] } });
  assert.equal(ok.code, 200);
  const k = banco.consultas.find(c => /insert into tentativas/.test(c.texto));
  assert.match(String(k.vals[0]), /^im:[a-f0-9]{32}:\d+$/, 'contador por conta e por hora');
  assert.equal(k.vals.length >= 1, true);
  // a conta já está bloqueada nesta janela
  tmdb.chamadas = [];
  banco.resposta = (t, v) => (/select ate from tentativas/.test(t) ? [{ ate: Date.now() + 20 * 6e4 }] : base()(t, v));
  const r = await chamar('tmdb', { metodo: 'POST', body: { itens: [{ tipo: 'movie', tmdb: '1' }] } });
  assert.equal(r.code, 429);
  assert.match(r.body.erro, /Muitas tentativas/);
  assert.equal(tmdb.chamadas.length, 0);
});

/* ---------- link público ---------- */
test('/api/compartilhar: cria código aleatório, reaproveita o existente e desliga', async () => {
  let gravado = null;
  banco.resposta = base((t, v) => {
    if (/select publico, jsonb_array_length/.test(t))
      return v[0] === 'top-1'
        ? [{ publico: null, n: 3 }]
        : v[0] === 'top-2'
          ? [{ publico: 'abc123DEF456', n: 2 }]
          : v[0] === 'top-vazio'
            ? [{ publico: null, n: 0 }]
            : [];
    if (/update tops set publico = \?, publico_em/.test(t)) gravado = v[0];
  });
  const r = await chamar('t', { metodo: 'POST', body: { id: 'top-1', ativo: true } });
  assert.match(r.body.codigo, /^[\w-]{12}$/);
  assert.equal(gravado, r.body.codigo);
  assert.equal((await chamar('t', { metodo: 'POST', body: { id: 'top-2', ativo: true } })).body.codigo, 'abc123DEF456');
  assert.equal((await chamar('t', { metodo: 'POST', body: { id: 'top-2', ativo: false } })).body.codigo, null);
  assert.ok(banco.consultas.some(c => /set publico = null, publico_em = null/.test(c.texto)));
  assert.equal((await chamar('t', { metodo: 'POST', body: { id: 'nao-existe', ativo: true } })).code, 404);
  assert.equal((await chamar('t', { metodo: 'POST', body: { id: 'top-vazio', ativo: true } })).code, 400);
  assert.equal((await chamar('t', { metodo: 'POST', body: { id: 'ruim!', ativo: true } })).code, 400);
  assert.equal((await chamar('t', { metodo: 'POST', body: { id: 'top-1', ativo: true }, logado: false })).code, 401);
});

test('/api/compartilhar: só mexe em tops do próprio usuário', async () => {
  banco.resposta = base(() => []);
  banco.consultas = [];
  await chamar('t', { metodo: 'POST', body: { id: 'top-1', ativo: true } });
  const q = banco.consultas.find(c => /select publico, jsonb_array_length/.test(c.texto));
  assert.deepEqual(q.vals, ['top-1', 'u1']);
});

test('/api/dados: devolve o próximo lançamento e os links públicos; o ETag muda ao compartilhar', async () => {
  let pm = 0;
  banco.resposta = base(t => {
    if (/from titulos where user_id/.test(t) && /count\(\*\)/.test(t)) return [{ n: 1, m: 5 }];
    if (/from tops where user_id/.test(t) && /count\(\*\)/.test(t)) return [{ n: 1, m: 5, p: pm ? 1 : 0, pm }];
    if (/select \* from titulos/.test(t))
      return [{ id: 's1', tipo: 'tv', nome: 'S', eps: [1], vis: [0], criado: 1, atualizado: 5, hist: {}, proximo: { d: '2026-11-06', t: 1, e: 1 } }];
    if (/select \* from tops/.test(t)) return [{ id: 't1', nome: 'Top', itens: [], criado: 1, atualizado: 5, publico: pm ? 'codigo123456' : null }];
  });
  const a = await chamar('dados');
  assert.deepEqual(a.body.series[0].proximo, { d: '2026-11-06', t: 1, e: 1 });
  assert.deepEqual(a.body.links, {});
  pm = 99;
  const b = await chamar('dados');
  assert.deepEqual(b.body.links, { t1: 'codigo123456' });
  assert.notEqual(a.h.etag, b.h.etag);
});

test('/api/sync: grava o próximo lançamento junto com o título', async () => {
  banco.resposta = base(t => (/insert into titulos/.test(t) ? [{ id: 's1', atualizado: 1 }] : []));
  banco.consultas = [];
  await chamar('sync', { metodo: 'POST', body: { titulos: [{ id: 's1', nome: 'S', eps: [3], vis: [0], proximo: { d: '2026-11-06', t: 1, e: 2 } }] } });
  const q = banco.consultas.find(c => /insert into titulos/.test(c.texto));
  assert.ok(q.vals.includes(JSON.stringify({ d: '2026-11-06', t: 1, e: 2 })));
  assert.match(q.texto, /proximo = excluded\.proximo/);
});

/* ---------- página pública ---------- */
test('/t/<código>: HTML com Open Graph, nomes escapados, só o primeiro nome do autor e capas https', async () => {
  banco.resposta = (t, v) => {
    if (/from tops t join usuarios u/.test(t))
      return v[0] === 'codigo123456'
        ? [
            {
              nome: 'Melhores <b>2026</b>',
              itens: [{ t: 'Dark', sid: 'a' }, { t: 'Severance & Cia', sid: 'b' }, { t: 'Sem capa' }],
              user_id: 'u1',
              autor: 'Ana Souza',
            },
          ]
        : [];
    if (/select id, capa from titulos/.test(t))
      return [
        { id: 'a', capa: 'https://image.tmdb.org/t/p/w342/dark.jpg' },
        { id: 'b', capa: 'data:image/jpeg;base64,AAAA' },
      ];
  };
  const r = await chamar('t', { query: { c: 'codigo123456' }, logado: false });
  assert.equal(r.code, 200);
  assert.match(r.h['content-type'], /text\/html/);
  assert.match(r.h['cache-control'], /s-maxage=30/);
  assert.ok(r.body.includes('Melhores &lt;b&gt;2026&lt;/b&gt;'));
  assert.ok(!r.body.includes('<b>2026</b>'));
  assert.ok(r.body.includes('Severance &amp; Cia'));
  assert.ok(r.body.includes('<meta property="og:image" content="https://image.tmdb.org/t/p/w342/dark.jpg">'));
  assert.ok(r.body.includes('por Ana'));
  assert.ok(!r.body.includes('Souza'));
  assert.ok(!r.body.includes('data:image')); // capa em base64 não vai para a página
  assert.ok(r.body.includes('noindex'));
});

test('/t/<código>: código inexistente ou malformado dá 404 sem cache; erro de banco dá 500 sem vazar detalhes', async () => {
  banco.resposta = () => [];
  const a = await chamar('t', { query: { c: 'naoexiste1234' }, logado: false });
  assert.equal(a.code, 404);
  assert.equal(a.h['cache-control'], 'no-store');
  assert.equal((await chamar('t', { query: { c: "x'; drop table tops;--" }, logado: false })).code, 404);
  assert.equal((await chamar('t', { query: {}, logado: false })).code, 404);
  banco.resposta = () => {
    throw new Error('senha do banco: segredo');
  };
  const o = console.error;
  console.error = () => {}; // o erro real é registrado no log do servidor
  const e = await chamar('t', { query: { c: 'codigo123456' }, logado: false }).finally(() => {
    console.error = o;
  });
  assert.equal(e.code, 500);
  assert.ok(!e.body.includes('segredo'));
});

test('vercel.json: /t/:codigo é reescrito para a página pública', () => {
  const v = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'vercel.json'), 'utf8'));
  assert.deepEqual(v.rewrites, [{ source: '/t/:codigo', destination: '/api/t?c=:codigo' }]);
});
