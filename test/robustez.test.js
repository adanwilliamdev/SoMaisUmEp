// Robustez: checagem de origem (CSRF), cotas por conta, health check, prazo das requisições e tratamento global de erros.
process.env.SESSION_SECRET = 'segredo-de-teste-segredo-de-teste';
process.env.DATABASE_URL = 'postgresql://x:y@localhost/z';

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
      sql.transaction = (qs) => Promise.all(qs);
      return sql;
    },
  },
  '@vercel/blob': {
    put: async () => ({ url: '' }),
    del: async () => {},
    list: async () => ({ blobs: [], hasMore: false }),
  },
};
const carregar = Module._load;
Module._load = function (req, ...resto) {
  return falsos[req] || carregar.call(this, req, ...resto);
};

const { assinar } = require('../api/_lib');
const { origemOk } = require('../api/_origem');

const USER = { id: 'u1', nome: 'Ana', email: 'ana@exemplo.com', versao: 1 };
const cookie = () => {
  const v = `${USER.id}.${USER.versao}.${Date.now() + 864e5}`;
  return `sessao=${v}.${assinar(v)}`;
};
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
async function chamar(
  arquivo,
  { metodo = 'POST', body, query = {}, headers = {}, logado = true } = {},
) {
  const res = novoRes();
  await require('../api/' + arquivo)(
    {
      method: metodo,
      body,
      query,
      headers: { ...(logado ? { cookie: cookie() } : {}), ...headers },
    },
    res,
  );
  return res;
}
const sessao = (extra) => (t, v) =>
  /select id, nome, email, versao from usuarios/.test(t)
    ? [USER]
    : extra
      ? extra(t, v) || []
      : [];

/* ---------- origem ---------- */
test('origemOk: GET sempre passa; POST sem Origin passa; POST do mesmo site passa', () => {
  assert.ok(origemOk({ method: 'GET', headers: { origin: 'https://mau.com' } }));
  assert.ok(origemOk({ method: 'POST', headers: { host: 'app.com' } }));
  assert.ok(
    origemOk({ method: 'POST', headers: { host: 'app.com', origin: 'https://app.com' } }),
  );
  assert.ok(
    origemOk({
      method: 'POST',
      headers: { host: 'interno', 'x-forwarded-host': 'app.com', origin: 'https://app.com' },
    }),
  );
});
test('origemOk: POST de outro site, Origin inválido ou sec-fetch-site cross-site são recusados', () => {
  assert.ok(
    !origemOk({ method: 'POST', headers: { host: 'app.com', origin: 'https://mau.com' } }),
  );
  assert.ok(!origemOk({ method: 'POST', headers: { host: 'app.com', origin: 'null' } }));
  assert.ok(
    !origemOk({
      method: 'POST',
      headers: { host: 'app.com', origin: 'https://app.com', 'sec-fetch-site': 'cross-site' },
    }),
  );
  assert.ok(
    !origemOk({
      method: 'DELETE',
      headers: { host: 'app.com', origin: 'https://app.com.mau.com' },
    }),
  );
});
test('endpoint de escrita responde 403 para Origin de outro site, sem tocar no banco', async () => {
  banco.consultas = [];
  banco.resposta = sessao();
  const r = await chamar('sync', {
    body: { titulos: [] },
    headers: { host: 'app.com', origin: 'https://mau.com' },
  });
  assert.equal(r.code, 403);
  assert.equal(banco.consultas.length, 0);
});
test('endpoint de escrita aceita o mesmo Origin', async () => {
  banco.resposta = sessao();
  const r = await chamar('sync', {
    body: {},
    headers: { host: 'app.com', origin: 'https://app.com' },
  });
  assert.equal(r.code, 200);
});

/* ---------- cotas ---------- */
const titulo = (id) => ({ id, nome: 'X', tipo: 'tv', eps: [3], vis: [0] });
test('sync: recusa título novo acima da cota (413), mas aceita atualizar os já existentes', async () => {
  banco.resposta = sessao((t) =>
    /from titulos where user_id = \? *$/.test(t) && /count\(\*\)::int as n/.test(t)
      ? [{ n: 5000, ja: 0 }]
      : [],
  );
  const cheio = await chamar('sync', { body: { titulos: [titulo('novo')] } });
  assert.equal(cheio.code, 413);
  assert.match(cheio.body.erro, /5000/);

  banco.resposta = sessao((t) =>
    /count\(\*\)::int as n/.test(t) ? [{ n: 5000, ja: 1 }] : [{ id: 'velho', atualizado: 1 }],
  );
  const ok = await chamar('sync', { body: { titulos: [titulo('velho')] } });
  assert.equal(ok.code, 200);
});
test('sync: recusa Top novo acima da cota', async () => {
  banco.resposta = sessao((t) =>
    /from tops where user_id/.test(t) && /count\(\*\)::int as n/.test(t) ? [{ n: 200, ja: 0 }] : [],
  );
  const r = await chamar('sync', { body: { tops: [{ id: 'p1', nome: 'T', itens: [] }] } });
  assert.equal(r.code, 413);
});

/* ---------- health check ---------- */
test('saúde: 200 quando o banco responde, sem exigir login e sem cache', async () => {
  banco.resposta = () => [{ '?column?': 1 }];
  const r = await chamar('dados', { metodo: 'GET', query: { r: 'saude' }, logado: false });
  assert.equal(r.code, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ['banco', 'config', 'ok', 'versao']);
  assert.equal(r.body.ok, true);
  assert.equal(r.h['cache-control'], 'no-store');
});
test('saúde: 503 sem vazar o erro quando o banco falha', async () => {
  banco.resposta = () => {
    throw new Error('password authentication failed for user "x" host db.secreto.neon.tech');
  };
  const r = await chamar('dados', { metodo: 'GET', query: { r: 'saude' }, logado: false });
  assert.equal(r.code, 503);
  assert.equal(r.body.ok, false);
  assert.ok(!JSON.stringify(r.body).includes('secreto'));
});

/* ---------- frontend: prazo e erros globais ---------- */
test('api: pedido que passa do prazo vira erro de rede (não trava a fila)', async () => {
  const { api } = await import('../public/js/api.js');
  const antes = globalThis.fetch;
  globalThis.fetch = (url, { signal }) =>
    new Promise((_, no) =>
      signal.addEventListener('abort', () =>
        no(Object.assign(new Error('abortado'), { name: 'AbortError' })),
      ),
    );
  try {
    await assert.rejects(
      api('/api/dados', { prazo: 20 }),
      (e) => e.rede === true && e.demorou === true && /demorou/.test(e.message),
    );
  } finally {
    globalThis.fetch = antes;
  }
});
test('api: falha de rede e 401 continuam com as flags de sempre', async () => {
  const { api } = await import('../public/js/api.js');
  const antes = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    await assert.rejects(api('/x'), (e) => e.rede === true && !e.demorou);
    globalThis.fetch = async () => ({
      status: 401,
      ok: false,
      json: async () => ({ erro: 'Não autorizado' }),
    });
    await assert.rejects(api('/x'), (e) => e.auth === true);
  } finally {
    globalThis.fetch = antes;
  }
});
test('erros globais: avisa no máximo uma vez por janela e ignora erros de rede/auth', async () => {
  const { instalarErros } = await import('../public/js/erros.js');
  const ev = {};
  const alvo = { addEventListener: (n, f) => (ev[n] = f) };
  const avisos = [];
  let t = 1000;
  const log = console.error;
  console.error = () => {};
  try {
    instalarErros((m) => avisos.push(m), alvo, () => t);
    ev.error({ message: 'boom', error: new Error('boom') });
    ev.error({ message: 'boom2' });
    assert.equal(avisos.length, 1);
    ev.error({ message: 'ResizeObserver loop completed with undelivered notifications.' });
    ev.unhandledrejection({ reason: { rede: true } });
    ev.unhandledrejection({ reason: { auth: true } });
    assert.equal(avisos.length, 1);
    t += 16000;
    ev.unhandledrejection({ reason: new Error('x') });
    assert.equal(avisos.length, 2);
    assert.ok(!avisos[0].includes('boom'));
  } finally {
    console.error = log;
  }
});
