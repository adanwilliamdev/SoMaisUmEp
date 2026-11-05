// Web Push sem dependências: cifra a mensagem (RFC 8291, aes128gcm) e assina a requisição com VAPID (RFC 8292),
// só com o módulo `crypto` do Node. Nada aqui toca no banco nem na rede, exceto enviar(), que recebe o fetch por parâmetro.
//
// Variáveis de ambiente: VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY (gere com `npm run vapid`) e VAPID_SUBJECT
// (mailto:voce@exemplo.com ou https://seu-site). Sem elas os avisos ficam desligados e o resto do app funciona igual.
const crypto = require('crypto');

const b64 = {
  de: t => Buffer.from(String(t), 'base64url'),
  para: b => Buffer.from(b).toString('base64url'),
};

// Os serviços de push dos navegadores. O servidor só envia para estes endereços: um endpoint inventado por quem tem
// conta (ex.: http://169.254.169.254/...) faria o cron da Vercel chamar qualquer lugar (SSRF).
const SERVICOS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge, Brave, Opera, Samsung Internet (Android e computador)
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/, // Safari (macOS e iOS 16.4+)
  /\.push\.apple\.com$/,
  /\.notify\.windows\.com$/, // Edge no Windows (WNS)
];

// Devolve a URL normalizada ou null. Só https, porta padrão, sem usuário/senha e de um dos serviços acima.
function endpointOk(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 700) return null;
  let u;
  try {
    u = new URL(endpoint);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  return SERVICOS.some(re => re.test(u.hostname)) ? u.href : null;
}

// Chave pública do aparelho (65 bytes, ponto não comprimido da curva P-256) e segredo de autenticação (16 bytes).
const chaveAparelhoOk = t => /^[\w-]{87}$/.test(String(t)) && b64.de(t).length === 65 && b64.de(t)[0] === 4;
const authAparelhoOk = t => /^[\w-]{22}$/.test(String(t)) && b64.de(t).length === 16;

/* ---------- VAPID ---------- */
// Lê e confere as chaves do servidor. Devolve null se faltar alguma (avisos desligados); lança se estiverem erradas.
function chaves(env = process.env) {
  const pub = env.VAPID_PUBLIC_KEY,
    priv = env.VAPID_PRIVATE_KEY,
    assunto = env.VAPID_SUBJECT;
  if (!pub || !priv || !assunto) return null;
  if (!/^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(assunto)) throw new Error('VAPID_SUBJECT deve ser mailto:voce@exemplo.com ou https://seu-site');
  const P = b64.de(pub),
    d = b64.de(priv);
  if (P.length !== 65 || P[0] !== 4) throw new Error('VAPID_PUBLIC_KEY inválida (65 bytes em base64url). Gere de novo com npm run vapid.');
  if (d.length !== 32) throw new Error('VAPID_PRIVATE_KEY inválida (32 bytes em base64url). Gere de novo com npm run vapid.');
  const privada = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: b64.para(P.subarray(1, 33)), y: b64.para(P.subarray(33)), d: b64.para(d) }, format: 'jwk' });
  // O Node aceita um JWK cujo x/y não pertence ao d, então a conferência é feita à parte: a pública derivada de d tem de ser a configurada.
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(d);
  if (!ecdh.getPublicKey().equals(P)) throw new Error('VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY não são um par. Gere as duas juntas com npm run vapid.');
  return { publica: pub, privada, assunto };
}

// JWT ES256 que prova ao serviço de push que quem envia é o dono das chaves. Vale 12 h (o máximo permitido é 24 h).
function jwt(endpoint, vapid, agora = Date.now()) {
  const cab = b64.para(JSON.stringify({ typ: 'JWT', alg: 'ES256' })),
    corpo = b64.para(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(agora / 1000) + 12 * 3600, sub: vapid.assunto }));
  const assinatura = crypto.sign('sha256', Buffer.from(`${cab}.${corpo}`), { key: vapid.privada, dsaEncoding: 'ieee-p1363' }); // r||s, 64 bytes
  return `${cab}.${corpo}.${b64.para(assinatura)}`;
}
const autorizacao = (endpoint, vapid, agora) => `vapid t=${jwt(endpoint, vapid, agora)}, k=${vapid.publica}`;

/* ---------- cifragem (RFC 8291) ---------- */
const MAX_TEXTO = 3993; // 4096 - cabeçalho (86) - delimitador (1) - etiqueta GCM (16)
const hkdf = (ikm, salt, info, n) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, n));

// `opc.efemeraPrivada` e `opc.salt` existem só para o teste reproduzir o exemplo da RFC; em produção são sorteados.
function cifrar(mensagem, { p256dh, auth }, opc = {}) {
  const ua = b64.de(p256dh),
    segredoAuth = b64.de(auth),
    texto = Buffer.concat([Buffer.from(mensagem), Buffer.from([2])]); // 0x02 = último (e único) registro
  if (ua.length !== 65 || ua[0] !== 4 || segredoAuth.length !== 16) throw new Error('Assinatura de push inválida');
  if (texto.length - 1 > MAX_TEXTO) throw new Error('Mensagem grande demais para o Web Push');
  const ecdh = crypto.createECDH('prime256v1');
  if (opc.efemeraPrivada) ecdh.setPrivateKey(b64.de(opc.efemeraPrivada));
  else ecdh.generateKeys();
  const servidor = ecdh.getPublicKey(); // 65 bytes
  const ecdhSecret = ecdh.computeSecret(ua); // lança se a chave do aparelho não for um ponto válido da curva
  const ikm = hkdf(ecdhSecret, segredoAuth, Buffer.concat([Buffer.from('WebPush: info\0'), ua, servidor]), 32);
  const salt = opc.salt ? b64.de(opc.salt) : crypto.randomBytes(16);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16),
    nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const cifrado = Buffer.concat([c.update(texto), c.final(), c.getAuthTag()]);
  const cab = Buffer.alloc(21); // salt (16) + tamanho do registro (4) + tamanho da chave (1), depois a chave pública do servidor
  salt.copy(cab, 0);
  cab.writeUInt32BE(4096, 16);
  cab[20] = servidor.length;
  return Buffer.concat([cab, servidor, cifrado]);
}

/* ---------- envio ---------- */
// Envia `payload` (objeto, vira JSON) para uma assinatura { endpoint, p256dh, auth }.
// Devolve { status, ok, gone }: gone = o serviço diz que a assinatura não existe mais (404/410) e pode ser apagada.
async function enviar(assinatura, payload, vapid, { agora = Date.now(), fetchFn = fetch, ttl = 12 * 3600 } = {}) {
  const url = endpointOk(assinatura.endpoint);
  if (!url) return { status: 0, ok: false, gone: true }; // endereço fora da lista: nunca é chamado
  const corpo = cifrar(JSON.stringify(payload), assinatura);
  const r = await fetchFn(url, {
    method: 'POST',
    headers: { Authorization: autorizacao(url, vapid, agora), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: 'normal' },
    body: corpo,
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  return { status: r.status, ok: r.status >= 200 && r.status < 300, gone: r.status === 404 || r.status === 410 };
}

module.exports = { b64, SERVICOS, endpointOk, chaveAparelhoOk, authAparelhoOk, chaves, jwt, autorizacao, cifrar, enviar, MAX_TEXTO };
