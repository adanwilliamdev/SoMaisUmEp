// Validação e limpeza de tudo que chega do navegador. Sem dependências: pode ser testado direto.
const { erro } = require('./_erro');

const ID = /^[\w-]{1,64}$/;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

const txt = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '') || null;
const inteiros = (a, max) => (Array.isArray(a) ? a.slice(0, 60) : []).map(n => Math.max(0, Math.min(max, parseInt(n, 10) || 0)));
const num = (v, min, max, casas = 0) =>
  v == null || v === '' || !Number.isFinite(+v) ? null : Math.round(Math.min(max, Math.max(min, +v)) * 10 ** casas) / 10 ** casas;

// Capas aceitas: link do TMDb, imagem JPEG pequena em base64 ou arquivo do próprio usuário no Vercel Blob.
function capaOk(c, userId) {
  if (typeof c !== 'string' || c.length > 120000) return null;
  if (/^https:\/\/image\.tmdb\.org\//.test(c)) return c;
  if (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(c)) return c;
  if (
    userId &&
    ID.test(userId) &&
    c.length < 600 &&
    new RegExp(`^https://[a-z0-9-]+\\.public\\.blob\\.vercel-storage\\.com/capas/${userId}/[\\w./-]+$`).test(c)
  )
    return c;
  return null;
}

function historico(h) {
  const o = {};
  if (h && typeof h === 'object' && !Array.isArray(h)) {
    for (const k of Object.keys(h).slice(0, 240))
      if (MES.test(k)) {
        const n = Math.max(0, Math.min(99999, parseInt(h[k], 10) || 0));
        if (n) o[k] = n;
      }
  }
  return o;
}

const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
// Próximo lançamento: { d: 'AAAA-MM-DD', t?: temporada, e?: episódio }. Qualquer outra coisa vira null.
function proximo(p) {
  if (!p || typeof p !== 'object' || !DATA.test(String(p.d || ''))) return null;
  const o = { d: p.d },
    t = num(p.t, 1, 999),
    e = num(p.e, 1, 9999);
  if (t) o.t = t;
  if (e) o.e = e;
  return o;
}

function titulo(x, userId) {
  if (!x || !ID.test(x.id || '')) throw erro('Título inválido');
  const tipo = x.tipo === 'movie' ? 'movie' : 'tv';
  const eps = tipo === 'movie' ? [1] : inteiros(x.eps, 999).map(n => Math.max(1, n));
  if (!eps.length) throw erro('Série sem temporadas');
  const v = inteiros(x.vis, 999);
  return {
    id: x.id,
    tipo,
    nome: txt(x.nome, 80) || 'Sem nome',
    capa: capaOk(x.capa, userId),
    sinopse: txt(x.sinopse, 2000),
    ano: txt(x.ano, 10),
    nota: num(x.nota, 0, 10, 1),
    duracao: num(x.duracao, 0, 1000),
    tmdb: num(x.tmdb, 0, 1e9),
    eps,
    vis: eps.map((n, i) => Math.min(v[i] || 0, n)),
    criado: num(x.criado, 0, 8.64e15) ?? Date.now(),
    nota_pessoal: num(x.nota_pessoal, 0, 10, 1),
    resenha: txt(x.resenha, 4000),
    visto_em: num(x.visto_em, 0, 8.64e15),
    hist: historico(x.hist),
    proximo: proximo(x.proximo),
    base: num(x.base, 0, 8.64e15), // versão que o navegador conhecia (controle de edição simultânea)
  };
}

function top(x) {
  if (!x || !ID.test(x.id || '')) throw erro('Top inválido');
  const itens = (Array.isArray(x.itens) ? x.itens : [])
    .slice(0, 10)
    .map(i => ({ t: txt(i && i.t, 80), sid: i && ID.test(i.sid || '') ? i.sid : undefined }))
    .filter(i => i.t);
  return { id: x.id, nome: txt(x.nome, 60) || 'Top 10', itens, criado: num(x.criado, 0, 8.64e15) ?? Date.now(), base: num(x.base, 0, 8.64e15) };
}

// Exclusões: aceita ids soltos (formato antigo) ou { id, base }, onde base é a versão que o navegador conhecia.
// Com base, o servidor só apaga se ninguém alterou o item depois; sem base, apaga sempre (comportamento antigo).
const exclusoes = a =>
  (Array.isArray(a) ? a : [])
    .slice(0, 200)
    .map(x => (typeof x === 'string' ? { id: x, base: null } : x && typeof x === 'object' ? { id: x.id, base: num(x.base, 0, 8.64e15) } : null))
    .filter(x => x && typeof x.id === 'string' && ID.test(x.id));

const ids = a => (Array.isArray(a) ? a : []).filter(i => typeof i === 'string' && ID.test(i)).slice(0, 200);

function email(v) {
  const e = String(v || '')
    .trim()
    .toLowerCase();
  if (e.length > 120 || !EMAIL.test(e)) throw erro('Informe um e-mail válido');
  return e;
}
function senha(v) {
  const s = String(v || '');
  if (s.length < 8) throw erro('A senha precisa ter pelo menos 8 caracteres');
  if (s.length > 200) throw erro('Senha muito longa');
  return s;
}
const nomeUsuario = v =>
  txt(v, 60) ||
  (() => {
    throw erro('Informe seu nome');
  })();

// Assinatura de notificação push enviada pelo navegador: { endpoint, keys: { p256dh, auth } }. O endpoint precisa ser de um
// serviço de push conhecido (veja _webpush.js): o servidor vai chamá-lo, então não pode ser um endereço qualquer.
function assinaturaPush(a) {
  const W = require('./_webpush');
  const endpoint = W.endpointOk(a && a.endpoint),
    k = (a && a.keys) || {};
  if (!endpoint) throw erro('Este navegador usa um serviço de notificações que o app não suporta.');
  if (!W.chaveAparelhoOk(k.p256dh) || !W.authAparelhoOk(k.auth)) throw erro('Assinatura de notificação inválida');
  return { endpoint, p256dh: k.p256dh, auth: k.auth };
}

module.exports = { ID, txt, num, capaOk, historico, proximo, titulo, top, ids, exclusoes, email, senha, nomeUsuario, assinaturaPush };
