// Service worker do Claquete: abre o app rápido e funciona sem internet.
// Dados (/api) nunca passam pelo cache: o app guarda a própria cópia no aparelho (loja.js).
// Ao publicar uma versão nova, troque o número abaixo para renovar o cache.
const VERSAO = 'claquete-v4.0.0';
const SHELL = VERSAO + '-shell', IMAGENS = VERSAO + '-img', EXTERNO = VERSAO + '-ext';
const ARQUIVOS = [
  '/', '/style.css', '/tema.js', '/manifest.json', '/icons/icon.svg', '/icons/icon-192.png',
  '/js/main.js', '/js/util.js', '/js/api.js', '/js/loja.js', '/js/regras.js', '/js/views.js', '/js/capas.js', '/js/tmdbsync.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(ARQUIVOS.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !k.startsWith(VERSAO)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Responde do cache na hora e atualiza em segundo plano.
async function antigoEnovo(req, nome, limite) {
  const c = await caches.open(nome), guardado = await c.match(req, { ignoreSearch: false });
  const rede = fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque')) {
      c.put(req, r.clone());
      if (limite) c.keys().then(ks => { if (ks.length > limite) c.delete(ks[0]); });
    }
    return r;
  }).catch(() => null);
  return guardado || (await rede) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/')) return;                       // dados: sempre rede
    if (req.mode === 'navigate') {                                       // página: rede primeiro, cache se estiver offline
      e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(SHELL).then(x => x.put('/', c)); return r; })
        .catch(() => caches.match('/')));
      return;
    }
    e.respondWith(antigoEnovo(req, SHELL));
    return;
  }
  if (url.hostname === 'image.tmdb.org' || url.hostname.endsWith('.public.blob.vercel-storage.com')) { e.respondWith(antigoEnovo(req, IMAGENS, 250)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(antigoEnovo(req, EXTERNO));
});
