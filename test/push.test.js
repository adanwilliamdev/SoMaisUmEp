// Avisos por push (v5.2): cifragem (RFC 8291), VAPID, validação de endpoints, mensagem, envio diário, endpoints e service worker.
// Banco, Blob e rede são falsos: o que se confere é a lógica.
process.env.SESSION_SECRET = 'segredo-de-teste-segredo-de-teste';
process.env.DATABASE_URL = 'postgresql://x:y@localhost/z';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
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
  '@vercel/blob': { put: async () => ({}), del: async () => {}, list: async () => ({ blobs: [], hasMore: false }) },
};
const carregar = Module._load;
Module._load = function (req, ...resto) {
  return falsos[req] || carregar.call(this, req, ...resto);
};

const W = require('../api/_webpush');
const N = require('../api/_notificar');
const V = require('../api/_validar');
const { assinar } = require('../api/_lib');
const { gerar } = require('../scripts/vapid');
const { b64 } = W;

/* ---------- ajudantes ---------- */
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
// Lado do aparelho (independente do código do servidor: HKDF escrito à mão como na seção 3.4 da RFC).
function decifrar(corpo, { privada, publica, auth }) {
  const salt = corpo.subarray(0, 16),
    idlen = corpo[20],
    servidor = corpo.subarray(21, 21 + idlen),
    cifra = corpo.subarray(21 + idlen);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(privada);
  const ua = Buffer.from(publica),
    segredo = ecdh.computeSecret(servidor);
  const ikm = hmac(hmac(auth, segredo), Buffer.concat([Buffer.from('WebPush: info\0'), ua, servidor, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16),
    nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(cifra.subarray(cifra.length - 16));
  const texto = Buffer.concat([d.update(cifra.subarray(0, cifra.length - 16)), d.final()]);
  assert.equal(texto[texto.length - 1], 2, 'delimitador do último registro');
  return texto.subarray(0, -1).toString('utf8');
}
function aparelho() {
  const e = crypto.createECDH('prime256v1');
  e.generateKeys();
  const auth = crypto.randomBytes(16);
  return { privada: e.getPrivateKey(), publica: e.getPublicKey(), auth, assinatura: { p256dh: b64.para(e.getPublicKey()), auth: b64.para(auth) } };
}
const FCM = 'https://fcm.googleapis.com/fcm/send/abc123:APA91bExemplo';
const comVapid = () => {
  const k = gerar();
  return { ...k, VAPID_SUBJECT: 'mailto:eu@exemplo.com' };
};

/* ---------- cifragem ---------- */
test('cifrar: reproduz byte a byte o exemplo da RFC 8291 (seção 5)', () => {
  const corpo = W.cifrar(
    'When I grow up, I want to be a watermelon',
    { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' },
    { efemeraPrivada: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', salt: 'DGv6ra1nlYgDCS1FRnbzlw' },
  );
  assert.equal(
    b64.para(corpo),
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
  );
});

test('cifrar: o aparelho consegue decifrar (acentos, vazio e tamanho máximo); ida e volta com chaves aleatórias', () => {
  const ap = aparelho();
  for (const m of ['Sai hoje: Ação & Aventura ✓', '', 'x'.repeat(W.MAX_TEXTO)]) assert.equal(decifrar(W.cifrar(m, ap.assinatura), ap), m);
  assert.notDeepEqual(W.cifrar('a', ap.assinatura), W.cifrar('a', ap.assinatura), 'salt e chave efêmera mudam a cada envio');
});

test('cifrar: recusa mensagem grande demais e chaves inválidas', () => {
  const ap = aparelho();
  assert.throws(() => W.cifrar('x'.repeat(W.MAX_TEXTO + 1), ap.assinatura), /grande demais/);
  assert.throws(() => W.cifrar('oi', { p256dh: 'AAAA', auth: ap.assinatura.auth }), /inválida/);
  assert.throws(() => W.cifrar('oi', { p256dh: ap.assinatura.p256dh, auth: 'AAAA' }), /inválida/);
  const foraDaCurva = b64.para(Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]));
  assert.throws(() => W.cifrar('oi', { p256dh: foraDaCurva, auth: ap.assinatura.auth })); // ponto que não está na curva P-256
});

/* ---------- VAPID ---------- */
test('VAPID: gerar() cria um par que o servidor aceita; o JWT é ES256 e confere com a chave pública', () => {
  const env = comVapid();
  const v = W.chaves(env);
  assert.equal(b64.de(env.VAPID_PUBLIC_KEY).length, 65);
  assert.equal(b64.de(env.VAPID_PRIVATE_KEY).length, 32);
  const agora = 1_800_000_000_000;
  const [cab, corpo, sig] = W.jwt(FCM, v, agora).split('.');
  assert.deepEqual(JSON.parse(b64.de(cab)), { typ: 'JWT', alg: 'ES256' });
  assert.deepEqual(JSON.parse(b64.de(corpo)), { aud: 'https://fcm.googleapis.com', exp: 1_800_000_000 + 12 * 3600, sub: 'mailto:eu@exemplo.com' });
  const P = b64.de(env.VAPID_PUBLIC_KEY);
  const pub = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64.para(P.subarray(1, 33)), y: b64.para(P.subarray(33)) }, format: 'jwk' });
  assert.equal(b64.de(sig).length, 64, 'assinatura r||s de 64 bytes (não DER)');
  assert.ok(crypto.verify('sha256', Buffer.from(`${cab}.${corpo}`), { key: pub, dsaEncoding: 'ieee-p1363' }, b64.de(sig)));
  assert.ok(!crypto.verify('sha256', Buffer.from(`${cab}.${corpo}x`), { key: pub, dsaEncoding: 'ieee-p1363' }, b64.de(sig)));
  assert.match(W.autorizacao(FCM, v, agora), new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${env.VAPID_PUBLIC_KEY}$`));
});

test('VAPID: sem variáveis = desligado (null); chaves ou contato errados dão erro que diz o que fazer', () => {
  assert.equal(W.chaves({}), null);
  const env = comVapid();
  assert.equal(W.chaves({ ...env, VAPID_SUBJECT: undefined }), null);
  assert.throws(() => W.chaves({ ...env, VAPID_SUBJECT: 'eu@exemplo.com' }), /VAPID_SUBJECT/);
  assert.doesNotThrow(() => W.chaves({ ...env, VAPID_SUBJECT: 'https://somaisumep.vercel.app' }));
  assert.throws(() => W.chaves({ ...env, VAPID_PUBLIC_KEY: 'curta' }), /VAPID_PUBLIC_KEY inválida/);
  assert.throws(() => W.chaves({ ...env, VAPID_PRIVATE_KEY: 'curta' }), /VAPID_PRIVATE_KEY inválida/);
  assert.throws(() => W.chaves({ ...env, VAPID_PUBLIC_KEY: gerar().VAPID_PUBLIC_KEY }), /não são um par/);
});

/* ---------- endpoints permitidos (SSRF) ---------- */
test('endpointOk: só https dos serviços de push dos navegadores', () => {
  for (const ok of [
    FCM,
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QAbc123',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
    'https://fcm.googleapis.com:443/fcm/send/x',
  ])
    assert.ok(W.endpointOk(ok), ok);
  for (const ruim of [
    'http://fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com.evil.example/x',
    'https://evilfcm.googleapis.com/x',
    'https://fcm.googleapis.com@evil.example/x',
    'https://user:pw@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/x',
    'https://[::1]/x',
    'https://web.push.apple.com.evil.example/x',
    'ftp://fcm.googleapis.com/x',
    'fcm.googleapis.com/x',
    '',
    null,
    42,
    'https://fcm.googleapis.com/' + 'a'.repeat(800),
  ])
    assert.equal(W.endpointOk(ruim), null, String(ruim).slice(0, 60));
});

test('assinaturaPush: aceita o que o navegador envia e recusa o resto', () => {
  const ap = aparelho();
  assert.deepEqual(V.assinaturaPush({ endpoint: FCM, keys: ap.assinatura }), { endpoint: FCM, ...ap.assinatura });
  assert.throws(() => V.assinaturaPush({ endpoint: 'https://evil.example/x', keys: ap.assinatura }), /não suporta/);
  assert.throws(() => V.assinaturaPush({ endpoint: FCM, keys: { ...ap.assinatura, auth: 'curto' } }), /inválida/);
  assert.throws(() => V.assinaturaPush({ endpoint: FCM, keys: { ...ap.assinatura, p256dh: 'BCV' } }), /inválida/);
  assert.throws(() => V.assinaturaPush({ endpoint: FCM }), /inválida/);
  assert.throws(() => V.assinaturaPush(null), /não suporta/);
});

/* ---------- envio ---------- */
test('enviar: requisição com os cabeçalhos do Web Push, corpo que o aparelho decifra e interpretação do status', async () => {
  const v = W.chaves(comVapid()),
    ap = aparelho(),
    chamadas = [];
  const responde = status => async (url, opt) => {
    chamadas.push({ url, opt });
    return { status };
  };
  const msg = { titulo: 'Sai hoje: Série', corpo: 'Novo ep · T2 E3', url: '/#series', tag: 'lancamentos' };
  const r = await W.enviar({ endpoint: FCM, ...ap.assinatura }, msg, v, { fetchFn: responde(201) });
  assert.deepEqual(r, { status: 201, ok: true, gone: false });
  const { url, opt } = chamadas[0];
  assert.equal(url, FCM);
  assert.equal(opt.method, 'POST');
  assert.equal(opt.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(opt.headers['Content-Type'], 'application/octet-stream');
  assert.equal(opt.headers.TTL, String(12 * 3600));
  assert.match(opt.headers.Authorization, /^vapid t=.+, k=/);
  assert.equal(opt.redirect, 'error', 'não segue redirecionamentos');
  assert.deepEqual(JSON.parse(decifrar(opt.body, ap)), msg);

  assert.deepEqual(await W.enviar({ endpoint: FCM, ...ap.assinatura }, msg, v, { fetchFn: responde(410) }), { status: 410, ok: false, gone: true });
  assert.deepEqual(await W.enviar({ endpoint: FCM, ...ap.assinatura }, msg, v, { fetchFn: responde(404) }), { status: 404, ok: false, gone: true });
  assert.deepEqual(await W.enviar({ endpoint: FCM, ...ap.assinatura }, msg, v, { fetchFn: responde(500) }), { status: 500, ok: false, gone: false });
  assert.deepEqual(await W.enviar({ endpoint: FCM, ...ap.assinatura }, msg, v, { fetchFn: responde(429) }), { status: 429, ok: false, gone: false });
});

test('enviar: endereço fora da lista nunca é chamado', async () => {
  const v = W.chaves(comVapid()),
    ap = aparelho();
  let chamou = false;
  const r = await W.enviar({ endpoint: 'https://169.254.169.254/x', ...ap.assinatura }, { titulo: 't' }, v, {
    fetchFn: async () => {
      chamou = true;
      return { status: 201 };
    },
  });
  assert.equal(chamou, false);
  assert.equal(r.ok, false);
  assert.equal(r.gone, true); // inscrição inválida: o cron a apaga
});

/* ---------- mensagem e "hoje" ---------- */
test('montarMensagem: um título, vários, nova temporada, estreia e nomes longos', () => {
  assert.deepEqual(N.montarMensagem([{ nome: 'Série', tipo: 'tv', t: 2, e: 5 }]), { titulo: 'Sai hoje: Série', corpo: 'Novo ep · T2 E5', url: '/#series', tag: 'lancamentos' });
  assert.equal(N.montarMensagem([{ nome: 'Série', tipo: 'tv', t: 3, e: 1 }]).corpo, 'Nova temporada · T3 E1');
  assert.equal(N.montarMensagem([{ nome: 'Série', tipo: 'tv', t: 1, e: 1 }]).corpo, 'Novo ep · T1 E1', 'primeira temporada não é "nova temporada"');
  assert.equal(N.montarMensagem([{ nome: 'Filme', tipo: 'movie', t: null, e: null }]).corpo, 'Estreia');
  assert.equal(N.montarMensagem([{ nome: 'Série', tipo: 'tv', t: null, e: null }]).corpo, 'Novo ep');
  const v = N.montarMensagem(['A', 'B', 'C', 'D', 'E'].map(nome => ({ nome, tipo: 'tv' })));
  assert.equal(v.titulo, 'Sai hoje: 5 títulos');
  assert.equal(v.corpo, 'A, B, C e mais 2');
  assert.equal(N.montarMensagem([{ nome: 'A', tipo: 'tv' }, { nome: 'B', tipo: 'tv' }]).corpo, 'A e B');
  assert.ok(N.montarMensagem([{ nome: 'x'.repeat(200), tipo: 'tv' }]).titulo.length < 80);
});

test('dataNoFuso: "hoje" é a data em Brasília, não em UTC', () => {
  assert.equal(N.dataNoFuso(Date.UTC(2026, 10, 6, 2, 30), 'America/Sao_Paulo'), '2026-11-05'); // 23:30 do dia 5 em Brasília
  assert.equal(N.dataNoFuso(Date.UTC(2026, 10, 6, 11, 0), 'America/Sao_Paulo'), '2026-11-06'); // 08:00, horário do cron
  assert.equal(N.dataNoFuso(Date.UTC(2026, 10, 6, 11, 0), 'America/Manaus'), '2026-11-06');
  assert.equal(N.dataNoFuso(Date.UTC(2026, 10, 6, 2, 30), 'Fuso/Inexistente'), '2026-11-05', 'fuso inválido cai em UTC-3');
});

/* ---------- envio diário ---------- */
test('enviarLancamentos: manda só a quem tem lançamento hoje, marca o dia, apaga inscrições mortas e conta falhas', async () => {
  const agora = Date.UTC(2026, 10, 6, 11, 0); // 08:00 em Brasília, 2026-11-06
  const sub = (endpoint, user_id) => ({ endpoint, p256dh: 'p', auth: 'a', user_id });
  const subs = [sub('https://fcm.googleapis.com/a', 'ana'), sub('https://fcm.googleapis.com/b', 'ana'), sub('https://fcm.googleapis.com/c', 'beto'), sub('https://fcm.googleapis.com/d', 'caio'), sub('https://fcm.googleapis.com/e', 'ana')];
  const titulos = [
    { user_id: 'ana', nome: 'Zebra', tipo: 'tv', vis: [3], proximo: { d: '2026-11-06', t: 2, e: 1 } },
    { user_id: 'ana', nome: 'Alfa', tipo: 'tv', vis: [1], proximo: { d: '2026-11-06' } },
    { user_id: 'beto', nome: 'Filme visto', tipo: 'movie', vis: [1], proximo: { d: '2026-11-06' } }, // já assistido: não avisa
    { user_id: 'caio', nome: 'Filme novo', tipo: 'movie', vis: [0], proximo: { d: '2026-11-06' } },
  ];
  const consultas = [];
  const sql = (strings, ...vals) => {
    const t = strings.join('?').replace(/\s+/g, ' ').trim();
    consultas.push({ t, vals });
    if (/from push_assinaturas where ultimo_dia is distinct from/.test(t)) return Promise.resolve(subs);
    if (/from titulos where user_id = any/.test(t)) return Promise.resolve(titulos);
    return Promise.resolve([]);
  };
  const envios = [];
  const resultado = { 'https://fcm.googleapis.com/a': { ok: true }, 'https://fcm.googleapis.com/b': { ok: false, gone: true }, 'https://fcm.googleapis.com/d': { ok: true }, 'https://fcm.googleapis.com/e': { ok: false, gone: false } };
  const enviar = async (s, msg) => {
    envios.push({ endpoint: s.endpoint, msg });
    return resultado[s.endpoint];
  };
  const r = await N.enviarLancamentos(sql, { agora, vapid: {}, enviar });

  assert.deepEqual(r, { ativo: true, hoje: '2026-11-06', aparelhos: 5, enviados: 2, removidos: 1, falhas: 1 });
  assert.deepEqual(envios.map(e => e.endpoint).sort(), ['https://fcm.googleapis.com/a', 'https://fcm.googleapis.com/b', 'https://fcm.googleapis.com/d', 'https://fcm.googleapis.com/e']); // beto não recebe: o filme dele já foi visto
  assert.equal(envios.find(e => e.endpoint.endsWith('/a')).msg.titulo, 'Sai hoje: 2 títulos');
  assert.equal(envios.find(e => e.endpoint.endsWith('/a')).msg.corpo, 'Alfa e Zebra', 'nomes em ordem alfabética');
  assert.equal(envios.find(e => e.endpoint.endsWith('/d')).msg.corpo, 'Estreia');
  const marca = consultas.find(c => /update push_assinaturas set ultimo_dia/.test(c.t));
  assert.deepEqual(marca.vals, ['2026-11-06', ['https://fcm.googleapis.com/a', 'https://fcm.googleapis.com/d']]);
  const apaga = consultas.find(c => /delete from push_assinaturas/.test(c.t));
  assert.deepEqual(apaga.vals, [['https://fcm.googleapis.com/b']]);
  const q = consultas.find(c => /from titulos where user_id = any/.test(c.t));
  assert.deepEqual(q.vals, [['ana', 'beto', 'caio'], '2026-11-06']);
});

test('enviarLancamentos: sem chaves VAPID não faz nada; sem aparelhos pendentes não consulta títulos; erro de rede de um aparelho não derruba os outros', async () => {
  let n = 0;
  const sql = () => {
    n++;
    return Promise.resolve([]);
  };
  assert.deepEqual(await N.enviarLancamentos(sql, { vapid: null }), { ativo: false });
  assert.equal(n, 0);
  const r = await N.enviarLancamentos(sql, { vapid: {}, enviar: async () => ({ ok: true }) });
  assert.equal(r.aparelhos, 0);
  assert.equal(n, 1, 'só a consulta das inscrições');

  const sql2 = t => Promise.resolve(/push_assinaturas where/.test(t.join('?')) ? [{ endpoint: 'https://fcm.googleapis.com/a', p256dh: 'p', auth: 'a', user_id: 'u' }, { endpoint: 'https://fcm.googleapis.com/b', p256dh: 'p', auth: 'a', user_id: 'u' }] : /titulos/.test(t.join('?')) ? [{ user_id: 'u', nome: 'S', tipo: 'tv', vis: [1], proximo: { d: N.dataNoFuso() } }] : []);
  const r2 = await N.enviarLancamentos(sql2, {
    vapid: {},
    enviar: async s => {
      if (s.endpoint.endsWith('/a')) throw new Error('rede caiu');
      return { ok: true };
    },
  });
  assert.equal(r2.enviados, 1);
  assert.equal(r2.falhas, 1);
});

/* ---------- endpoints ---------- */
const USER = { id: 'u1', nome: 'Ana', email: 'ana@exemplo.com', versao: 1 };
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
    end() {
      return this;
    },
  };
};
async function chamar(arquivo, { metodo = 'POST', body, query = {}, headers = {}, logado = true } = {}) {
  const res = novoRes();
  await require('../api/' + arquivo)({ method: metodo, body, query, headers: { ...(logado ? { cookie: cookie() } : {}), ...headers } }, res);
  return res;
}
const base = extra => (t, v) => {
  if (/select id, nome, email, versao from usuarios/.test(t)) return [USER];
  if (/select ate from tentativas/.test(t)) return [];
  if (/insert into tentativas/.test(t)) return [{ falhas: 1 }];
  return extra ? extra(t, v) || [] : [];
};
const limparBanco = resposta => {
  banco.consultas = [];
  banco.resposta = base(resposta);
};
const ENV = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];
const semVapid = () => ENV.forEach(k => delete process.env[k]);
const ligarVapid = () => Object.assign(process.env, comVapid());

test('/api/dados?r=push (GET): exige login, devolve a chave só se o servidor estiver configurado e quantos aparelhos a conta tem', async () => {
  limparBanco(t => (/count\(\*\)::int as n from push_assinaturas/.test(t) ? [{ n: 2 }] : []));
  semVapid();
  assert.equal((await chamar('dados', { metodo: 'GET', query: { r: 'push' }, logado: false })).code, 401);
  assert.deepEqual((await chamar('dados', { metodo: 'GET', query: { r: 'push' } })).body, { chave: null, aparelhos: 2 });
  ligarVapid();
  const r = await chamar('dados', { metodo: 'GET', query: { r: 'push' } });
  assert.equal(r.body.chave, process.env.VAPID_PUBLIC_KEY);
  assert.ok(!JSON.stringify(r.body).includes(process.env.VAPID_PRIVATE_KEY), 'a chave privada nunca sai do servidor');
  assert.equal(r.h['cache-control'], 'no-store');
  semVapid();
});

test('/api/dados: outros métodos dão 405 e GET sem ?r=push continua devolvendo a biblioteca', async () => {
  limparBanco(t => (/count\(\*\)::int as n, coalesce\(max\(atualizado\)/.test(t) ? [{ n: 0, m: 0, p: 0, pm: 0 }] : []));
  const r = await chamar('dados', { metodo: 'PUT' });
  assert.equal(r.code, 405);
  assert.match(r.h.allow, /GET/);
  const g = await chamar('dados', { metodo: 'GET' });
  assert.ok(g.code === 200 && g.body.usuario, 'a biblioteca continua no GET sem r=push');
});

test('/api/dados (POST assinar): valida, grava com upsert por endpoint, limita aparelhos por conta e nunca grava endereço de fora da lista', async () => {
  limparBanco();
  const ap = aparelho();
  const assinatura = { endpoint: FCM, keys: ap.assinatura };
  assert.equal((await chamar('dados', { body: { acao: 'assinar', assinatura }, logado: false })).code, 401);
  assert.equal((await chamar('dados', { body: { acao: 'assinar', assinatura: { ...assinatura, endpoint: 'https://evil.example/x' } } })).code, 400);
  assert.equal((await chamar('dados', { body: { acao: 'assinar', assinatura: { ...assinatura, keys: { p256dh: 'x', auth: 'y' } } } })).code, 400);
  assert.equal((await chamar('dados', { body: { acao: 'apagar-tudo' } })).code, 400);
  assert.ok(!banco.consultas.some(c => /push_assinaturas/.test(c.texto)), 'nada foi gravado nos pedidos inválidos');

  const r = await chamar('dados', { body: { acao: 'assinar', assinatura } });
  assert.equal(r.code, 200);
  const ins = banco.consultas.find(c => /insert into push_assinaturas/.test(c.texto));
  assert.deepEqual(ins.vals.slice(0, 4), [FCM, 'u1', ap.assinatura.p256dh, ap.assinatura.auth]);
  assert.match(ins.texto, /on conflict \(endpoint\) do update/);
  assert.match(ins.texto, /ultimo_dia = case when push_assinaturas.user_id = excluded.user_id/, 'trocar de conta no mesmo aparelho zera o "já avisei hoje"');
  const lim = banco.consultas.find(c => /delete from push_assinaturas where user_id/.test(c.texto));
  assert.deepEqual(lim.vals, ['u1', 'u1', 10]);
});

test('/api/dados (POST cancelar): só apaga a assinatura da própria conta', async () => {
  limparBanco();
  assert.equal((await chamar('dados', { body: { acao: 'cancelar', endpoint: 'http://x' } })).code, 400);
  const r = await chamar('dados', { body: { acao: 'cancelar', endpoint: FCM } });
  assert.equal(r.code, 200);
  const d = banco.consultas.find(c => /delete from push_assinaturas/.test(c.texto));
  assert.match(d.texto, /where endpoint = \? and user_id = \?/);
  assert.deepEqual(d.vals, [FCM, 'u1']);
});

test('/api/dados (POST teste): exige servidor configurado, aparelho inscrito, respeita o limite e apaga inscrição expirada', async () => {
  const ap = aparelho();
  const linha = { endpoint: FCM, ...ap.assinatura };
  const fetchOriginal = globalThis.fetch;
  try {
    semVapid();
    limparBanco();
    assert.equal((await chamar('dados', { body: { acao: 'teste', endpoint: FCM } })).code, 503);

    ligarVapid();
    limparBanco(); // aparelho não inscrito
    globalThis.fetch = async () => ({ status: 201 });
    assert.equal((await chamar('dados', { body: { acao: 'teste', endpoint: FCM } })).code, 404);

    limparBanco(t => (/select endpoint, p256dh, auth from push_assinaturas/.test(t) ? [linha] : []));
    let enviado;
    globalThis.fetch = async (url, opt) => {
      enviado = { url, opt };
      return { status: 201 };
    };
    const ok = await chamar('dados', { body: { acao: 'teste', endpoint: FCM } });
    assert.equal(ok.code, 200);
    assert.equal(enviado.url, FCM);
    assert.equal(JSON.parse(decifrar(enviado.opt.body, ap)).tag, 'teste');

    globalThis.fetch = async () => ({ status: 410 });
    const velho = await chamar('dados', { body: { acao: 'teste', endpoint: FCM } });
    assert.equal(velho.code, 410);
    assert.ok(banco.consultas.some(c => /delete from push_assinaturas where endpoint/.test(c.texto)));

    globalThis.fetch = async () => ({ status: 500 });
    assert.equal((await chamar('dados', { body: { acao: 'teste', endpoint: FCM } })).code, 502);
    globalThis.fetch = async () => {
      throw new Error('rede');
    };
    assert.equal((await chamar('dados', { body: { acao: 'teste', endpoint: FCM } })).code, 502);

    limparBanco((t, v) => (/select ate from tentativas/.test(t) ? [{ ate: Date.now() + 6e5 }] : /select endpoint, p256dh, auth from push_assinaturas/.test(t) ? [linha] : []));
    banco.resposta = (t, v) => (/select ate from tentativas/.test(t) ? [{ ate: Date.now() + 6e5 }] : /select id, nome, email, versao from usuarios/.test(t) ? [USER] : []);
    assert.equal((await chamar('dados', { body: { acao: 'teste', endpoint: FCM } })).code, 429, 'passou do limite de testes');
  } finally {
    globalThis.fetch = fetchOriginal;
    semVapid();
  }
});

test('cron: com as chaves VAPID inclui o resultado dos avisos e uma falha neles não derruba a faxina', async () => {
  process.env.CRON_SECRET = 'segredo-do-cron';
  const cron = async () => chamar('cron', { metodo: 'GET', logado: false, headers: { authorization: 'Bearer segredo-do-cron' } });
  banco.consultas = [];
  banco.resposta = t => (/with d as \(delete/.test(t) ? [{ n: 0 }] : []);
  semVapid();
  const sem = await cron();
  assert.equal(sem.code, 200);
  assert.deepEqual(sem.body.push, { ativo: false });

  ligarVapid();
  const com = await cron();
  assert.equal(com.code, 200);
  assert.equal(com.body.push.ativo, true);
  assert.equal(com.body.push.aparelhos, 0);

  banco.resposta = t => {
    if (/from push_assinaturas where ultimo_dia/.test(t)) throw new Error('banco fora');
    return /with d as \(delete/.test(t) ? [{ n: 3 }] : [];
  };
  const erro = await cron();
  assert.equal(erro.code, 200, 'a faxina termina mesmo assim');
  assert.equal(erro.body.tentativas, 3);
  assert.deepEqual(erro.body.push, { ativo: true, erro: true });
  semVapid();
});

/* ---------- service worker ---------- */
function carregarSw() {
  const ouvintes = {},
    mostradas = [],
    aberturas = [];
  const janelas = [];
  const self_ = {
    addEventListener: (nome, fn) => (ouvintes[nome] = fn),
    location: { origin: 'https://somaisumep.test' },
    registration: { showNotification: async (t, o) => mostradas.push({ t, o }) },
    clients: { matchAll: async () => janelas, openWindow: async u => aberturas.push(u), claim: async () => {} },
    skipWaiting: async () => {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8'), { self: self_, caches: {}, fetch: async () => ({}), URL, Response: class {}, location: self_.location });
  return { ouvintes, mostradas, aberturas, janelas };
}
const evento = extra => {
  const e = { esperas: [], waitUntil(p) { this.esperas.push(p); }, ...extra };
  return e;
};

test('service worker: push vira notificação (texto puro, tag, só caminhos do próprio site) e sempre mostra algo', async () => {
  const sw = carregarSw();
  assert.ok(['push', 'notificationclick', 'pushsubscriptionchange'].every(n => typeof sw.ouvintes[n] === 'function'));
  const e = evento({ data: { json: () => ({ titulo: 'Sai hoje: <b>Série</b>', corpo: 'Novo ep · T2 E3', url: '/#series', tag: 'lancamentos' }) } });
  sw.ouvintes.push(e);
  await Promise.all(e.esperas);
  assert.equal(sw.mostradas.length, 1);
  assert.equal(sw.mostradas[0].t, 'Sai hoje: <b>Série</b>', 'o título é texto: o navegador não interpreta HTML em notificações');
  assert.deepEqual({ ...sw.mostradas[0].o.data }, { url: '/#series' });
  assert.equal(sw.mostradas[0].o.tag, 'lancamentos');
  assert.equal(sw.mostradas[0].o.icon, '/icons/icon-192.png');

  for (const url of ['//evil.example/x', 'https://evil.example/', 'javascript:alert(1)', 42, undefined]) {
    const x = evento({ data: { json: () => ({ titulo: 't', url }) } });
    sw.ouvintes.push(x);
    await Promise.all(x.esperas);
    assert.equal(sw.mostradas.at(-1).o.data.url, '/', 'url de fora vira "/": ' + String(url));
  }
  const vazio = evento({ data: null });
  sw.ouvintes.push(vazio);
  await Promise.all(vazio.esperas);
  assert.equal(sw.mostradas.at(-1).t, 'SóMaisUmEp', 'push sem corpo ainda mostra uma notificação (exigência dos navegadores)');
  const quebrado = evento({ data: { json: () => { throw new Error('não é JSON'); }, text: () => 'olá' } });
  sw.ouvintes.push(quebrado);
  await Promise.all(quebrado.esperas);
  assert.equal(sw.mostradas.at(-1).o.body, 'olá');
});

test('service worker: tocar na notificação traz a aba aberta para a frente ou abre o app', async () => {
  const sw = carregarSw();
  let fechou = 0,
    focou = 0;
  const notif = { close: () => fechou++, data: { url: '/#series' } };
  const e1 = evento({ notification: notif });
  sw.ouvintes.notificationclick(e1);
  await Promise.all(e1.esperas);
  assert.equal(fechou, 1);
  assert.deepEqual(sw.aberturas, ['https://somaisumep.test/#series']);

  sw.janelas.push({ url: 'https://somaisumep.test/#tops', focus: async () => focou++ });
  const e2 = evento({ notification: notif });
  sw.ouvintes.notificationclick(e2);
  await Promise.all(e2.esperas);
  assert.equal(focou, 1);
  assert.equal(sw.aberturas.length, 1, 'não abre outra janela se já existe uma');
});
