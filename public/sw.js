// Service worker do SóMaisUmEp: abre o app rápido e funciona sem internet.
// Imagens e fontes de outros sites são buscadas pelo próprio service worker, por isso esses
// endereços também precisam estar em connect-src no vercel.json.
// Dados (/api) nunca passam pelo cache: o app guarda a própria cópia no aparelho (loja.js).
// A versão do cache muda sozinha a cada deploy: scripts/build.js troca "dev" pelo commit (VERCEL_GIT_COMMIT_SHA) e
// preenche MODULOS com todos os arquivos de /js. Sem build (desenvolvimento) fica "dev" e o cache só guarda o essencial.
// Código (js/css/html/manifest) usa REDE PRIMEIRO: assim todos os módulos vêm do mesmo deploy e nunca se misturam
// versões; o cache só serve quando está offline. Ícones e imagens usam cache primeiro.
const VERSAO = 'somaisumep-dev';
const MODULOS = [];
const SHELL = VERSAO + '-shell',
  IMAGENS = VERSAO + '-img',
  EXTERNO = VERSAO + '-ext';
const ARQUIVOS = ['/', '/style.css', '/tema.js', '/manifest.json', '/icons/icon.svg', '/icons/icon-192.png', ...MODULOS];

self.addEventListener('install', e => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then(c => Promise.all(ARQUIVOS.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(ks => Promise.all(ks.filter(k => !k.startsWith(VERSAO)).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Responde do cache na hora e atualiza em segundo plano.
async function antigoEnovo(req, nome, limite) {
  const c = await caches.open(nome),
    guardado = await c.match(req, { ignoreSearch: false });
  const rede = fetch(req)
    .then(r => {
      if (r && (r.ok || r.type === 'opaque')) {
        c.put(req, r.clone());
        if (limite)
          c.keys().then(ks => {
            if (ks.length > limite) c.delete(ks[0]);
          });
      }
      return r;
    })
    .catch(() => null);
  return guardado || (await rede) || Response.error();
}

// Rede primeiro; se falhar (offline), usa a cópia guardada.
async function redePrimeiro(req, nome) {
  const c = await caches.open(nome);
  try {
    const r = await fetch(req);
    if (r && r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    return (await c.match(req)) || Response.error();
  }
}
const CODIGO = /\.(?:js|css|json|html)$/;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/api/')) return; // dados: sempre rede
    if (req.mode === 'navigate') {
      // página: rede primeiro, cache se estiver offline
      // Só o app (/) vira cópia offline; a página pública de um top (/t/...) não pode sobrescrevê-la.
      const app = url.pathname === '/';
      e.respondWith(
        fetch(req)
          .then(r => {
            if (app && r.ok) {
              const c = r.clone();
              caches.open(SHELL).then(x => x.put('/', c));
            }
            return r;
          })
          .catch(() => (app ? caches.match('/') : Response.error())),
      );
      return;
    }
    e.respondWith(CODIGO.test(url.pathname) ? redePrimeiro(req, SHELL) : antigoEnovo(req, SHELL));
    return;
  }
  if (url.hostname === 'image.tmdb.org' || url.hostname.endsWith('.public.blob.vercel-storage.com')) {
    if (req.mode === 'cors') return; // imagem para o canvas (imagem do top): vai direto à rede, senão o cache devolveria a cópia "opaca" e o canvas ficaria bloqueado
    e.respondWith(antigoEnovo(req, IMAGENS, 250));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(antigoEnovo(req, EXTERNO));
});

/* ---------- notificações push (avisos de episódios novos; quem envia é api/_notificar.js, no cron diário) ---------- */
// Toda mensagem push PRECISA virar uma notificação visível (é a regra do navegador e, no iOS, do sistema), então sempre mostra.
// O texto vem do servidor como JSON { titulo, corpo, url, tag } e é usado só como texto (nunca como HTML).
self.addEventListener('push', e => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { corpo: e.data ? e.data.text() : '' };
  }
  const url = typeof d.url === 'string' && /^\/(?!\/)/.test(d.url) ? d.url : '/'; // só caminhos deste site
  e.waitUntil(
    self.registration.showNotification(String(d.titulo || 'SóMaisUmEp').slice(0, 100), {
      body: String(d.corpo || '').slice(0, 300),
      icon: '/icons/icon-192.png',
      tag: String(d.tag || 'lancamentos').slice(0, 40), // a mesma tag substitui a notificação anterior em vez de empilhar
      data: { url },
    }),
  );
});

// Tocar na notificação abre o app (ou traz a aba que já está aberta para a frente).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(janelas => {
      const aberta = janelas.find(j => new URL(j.url).origin === self.location.origin && 'focus' in j);
      return aberta ? aberta.focus() : self.clients.openWindow(alvo);
    }),
  );
});

// O navegador trocou a inscrição (ex.: o serviço de push renovou): assina de novo e avisa o servidor.
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    (async () => {
      const chave = e.oldSubscription && e.oldSubscription.options && e.oldSubscription.options.applicationServerKey;
      const nova = e.newSubscription || (chave ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave }) : null);
      if (!nova) return;
      await fetch('/api/dados?r=push', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'assinar', assinatura: nova.toJSON() }),
      });
    })().catch(() => {}),
  );
});
