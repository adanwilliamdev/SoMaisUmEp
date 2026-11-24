// Endurecimentos: JPEG de verdade nas capas, segredo de sessão forte em produção e limite por conta nas consultas ao TMDb.
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
        return Promise.resolve(banco.resposta(texto, vals));
      };
      sql.transaction = qs => Promise.all(qs);
      return sql;
    },
  },
  '@vercel/blob': {
    put: async () => ({ url: 'https://x.public.blob.vercel-storage.com/capas/u1/capa-1.jpg' }),
    del: async () => {},
    list: async () => ({ blobs: [], hasMore: false }),
  },
};
const carregar = Module._load;
Module._load = function (req, ...resto) {
  return falsos[req] || carregar.call(this, req, ...resto);
};

const { assinar, segredoFraco } = require('../api/_lib');
const V = require('../api/_validar');

const USER = { id: 'u1', nome: 'Ana', email: 'ana@exemplo.com', versao: 1 };
const UID = USER.id;
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
async function chamar(arquivo, { metodo = 'POST', body, query = {}, logado = true } = {}) {
  const res = novoRes();
  await require('../api/' + arquivo)({ method: metodo, body, query, headers: logado ? { cookie: cookie() } : {} }, res);
  return res;
}
const base = extra => (t, v) => {
  if (/select id, nome, email, versao from usuarios/.test(t)) return [USER];
  if (/insert into tentativas/.test(t)) return [{ falhas: 1 }];
  return extra ? extra(t, v) || [] : [];
};

/* ---------- capas: só JPEG de verdade ---------- */
test('capaOk: rótulo de JPEG com outro conteúdo (HTML, SVG, texto) é recusado; assinatura FF D8 FF passa', () => {
  const html = Buffer.from('<script>alert(1)</script>').toString('base64');
  assert.equal(V.capaOk('data:image/jpeg;base64,' + html, UID), null);
  assert.equal(V.capaOk('data:image/jpeg;base64,AAAA', UID), null);
  assert.equal(V.capaOk('data:image/jpeg;base64,', UID), null);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]).toString('base64');
  assert.ok(jpeg.startsWith('/9j/'));
  assert.ok(V.capaOk('data:image/jpeg;base64,' + jpeg, UID));
});

test('upload de capa: não guarda no Blob algo que não começa como JPEG', async () => {
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_teste';
  banco.resposta = base(t => (/from capas where user_id/.test(t) ? [{ hora: 0, total: 0 }] : []));
  const html = 'data:image/jpeg;base64,' + Buffer.from('<html>oi</html>').toString('base64');
  assert.equal((await chamar('_h/capa', { body: { imagem: html } })).code, 400);
  const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]).toString('base64');
  assert.equal((await chamar('_h/capa', { body: { imagem: jpeg } })).code, 200);
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

/* ---------- segredo de sessão ---------- */
test('segredoFraco: menos de 32 caracteres é fraco', () => {
  const guardado = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'curto';
  assert.equal(segredoFraco(), true);
  process.env.SESSION_SECRET = 'x'.repeat(32);
  assert.equal(segredoFraco(), false);
  process.env.SESSION_SECRET = guardado;
});

test('em produção, segredo curto derruba a requisição com instrução clara; fora dela, segue normal', async () => {
  const guardado = { s: process.env.SESSION_SECRET, v: process.env.VERCEL_ENV };
  banco.resposta = base();
  try {
    process.env.SESSION_SECRET = 'curto';
    process.env.VERCEL_ENV = 'production';
    const r = await chamar('_h/login', { logado: false, body: { email: 'ana@exemplo.com', senha: 'qualquer-senha' } });
    assert.equal(r.code, 500);
    assert.match(r.body.erro, /SESSION_SECRET muito curto/);
    process.env.VERCEL_ENV = 'preview';
    const dev = await chamar('_h/login', { logado: false, body: { email: 'ana@exemplo.com', senha: 'qualquer-senha' } });
    assert.equal(dev.code, 401, 'fora de produção só vale a regra normal do login');
  } finally {
    process.env.SESSION_SECRET = guardado.s;
    if (guardado.v === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = guardado.v;
  }
});

/* ---------- limite de consultas ao TMDb ---------- */
test('/api/tmdb: conta que estourou o limite por hora recebe 429 sem chamar o TMDb', async () => {
  let chamadasTmdb = 0;
  const fetchOriginal = global.fetch;
  global.fetch = async () => {
    chamadasTmdb++;
    return { ok: true, json: async () => ({ results: [] }) };
  };
  process.env.TMDB_READ_TOKEN = 'eyJteXRva2Vu';
  try {
    banco.resposta = base(t => (/select ate from tentativas/.test(t) ? [{ ate: Date.now() + 5 * 6e4 }] : []));
    const r = await chamar('tmdb', { metodo: 'GET', query: { acao: 'busca', tipo: 'tv', q: 'dark' } });
    assert.equal(r.code, 429);
    assert.match(r.body.erro, /Muitas tentativas/);
    assert.equal(chamadasTmdb, 0);
    banco.resposta = base();
    const ok = await chamar('tmdb', { metodo: 'GET', query: { acao: 'busca', tipo: 'tv', q: 'dark' } });
    assert.equal(ok.code, 200);
    assert.equal(chamadasTmdb, 1);
    assert.ok(banco.consultas.some(c => /insert into tentativas/.test(c.texto) && c.vals.some(v => /^tm:[a-f0-9]{32}:\d+$/.test(String(v)))));
  } finally {
    global.fetch = fetchOriginal;
    delete process.env.TMDB_READ_TOKEN;
  }
});
