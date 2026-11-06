// Avisos de episódios novos por notificação push (bloco em "Minha conta"). A parte que decide o que mostrar está em push.js;
// o envio é feito pelo servidor (api/_notificar.js, no cron diário) e a exibição pelo service worker (sw.js).
import { $, aviso, ler, guardar } from '../util.js';
import { api } from '../api.js';
import { hojeISO } from '../regras.js';
import { chaveParaBytes, mesmaChave, diagnostico } from '../push.js';

const ROTA = '/api/dados?r=push';

export const suportaPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// O registro do service worker (nunca espera para sempre: sem HTTPS ele nem existe).
async function registro() {
  const r = await navigator.serviceWorker.getRegistration();
  if (!r) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise(ok => setTimeout(() => ok(null), 5000))]);
}
const assinaturaAtual = async () => {
  const reg = suportaPush() && (await registro());
  return reg ? reg.pushManager.getSubscription() : null;
};

let chaveServidor = null; // guardada para ativar() poder pedir a permissão logo no clique (o navegador exige gesto do usuário)

export const blocoPush = () =>
  `<section class="push-bloco" aria-labelledby="push-tit"><h3 id="push-tit">Avisos de episódios novos</h3><div id="push-corpo" aria-live="polite"><p class="aviso">Verificando…</p></div></section>`;

export async function pintaPush() {
  if (!$('#push-corpo')) return;
  let chave = null,
    erroServidor = false,
    inscrito = false;
  if (suportaPush()) {
    try {
      chave = (await api(ROTA)).chave;
    } catch {
      erroServidor = true;
    }
    inscrito = !!(await assinaturaAtual().catch(() => null));
  }
  chaveServidor = chave;
  const d = diagnostico({
    suporta: suportaPush(),
    ios: ios(),
    instalado: instalado(),
    permissao: suportaPush() ? Notification.permission : 'default',
    chave,
    inscrito,
    erroServidor,
  });
  const el = $('#push-corpo');
  if (!el) return; // o diálogo mudou de tela enquanto consultava
  const botoes = {
    ativo:
      '<div class="rodape-dlg esq"><button class="btn sec" data-act="push-teste">Enviar um aviso de teste</button><button class="btn sec" data-act="push-desativar">Desativar neste aparelho</button></div>',
    inativo: '<div class="rodape-dlg esq"><button class="btn" data-act="push-ativar">Ativar neste aparelho</button></div>',
  }[d.estado];
  el.innerHTML = `<p class="aviso">${d.texto}</p>${botoes || ''}`;
}

async function ativar(b) {
  b.disabled = true;
  try {
    const perm = await Notification.requestPermission(); // primeiro: precisa vir direto do clique
    if (perm !== 'granted') {
      aviso(perm === 'denied' ? 'As notificações estão bloqueadas no navegador.' : 'Sem a permissão não dá para avisar.');
      return;
    }
    if (!chaveServidor) throw new Error('O servidor ainda não está configurado para enviar avisos.');
    const reg = await registro();
    if (!reg) throw new Error('O app ainda não está pronto para notificações. Recarregue a página e tente de novo.');
    const bytes = chaveParaBytes(chaveServidor);
    let sub = await reg.pushManager.getSubscription();
    if (sub && !mesmaChave(sub.options.applicationServerKey, bytes)) {
      await sub.unsubscribe(); // a chave do servidor mudou: a inscrição antiga não serve mais
      sub = null;
    }
    sub = sub || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes }));
    await api(ROTA, { method: 'POST', body: { acao: 'assinar', assinatura: sub.toJSON() } });
    aviso('Avisos ativados neste aparelho.');
  } catch (e) {
    aviso(e.message || 'Não foi possível ativar os avisos.');
  } finally {
    pintaPush();
  }
}

async function desativar(b) {
  b.disabled = true;
  try {
    const sub = await assinaturaAtual();
    if (sub) {
      await api(ROTA, { method: 'POST', body: { acao: 'cancelar', endpoint: sub.endpoint } }).catch(() => {}); // se falhar, o servidor remove no próximo envio (404/410)
      await sub.unsubscribe();
    }
    aviso('Avisos desativados neste aparelho.');
  } catch (e) {
    aviso(e.message || 'Não foi possível desativar.');
  } finally {
    pintaPush();
  }
}

async function teste(b) {
  b.disabled = true;
  try {
    const sub = await assinaturaAtual();
    if (!sub) throw new Error('Este aparelho não está inscrito. Ative os avisos de novo.');
    await api(ROTA, { method: 'POST', body: { acao: 'teste', endpoint: sub.endpoint } });
    aviso('Aviso de teste enviado. Ele deve chegar em instantes.');
  } catch (e) {
    aviso(e.message || 'Não foi possível enviar o teste.');
  } finally {
    b.disabled = false;
  }
}

// Ao sair da conta: este aparelho deixa de receber avisos dela (importante em aparelho compartilhado).
export async function sairPush() {
  try {
    const sub = await assinaturaAtual();
    if (!sub) return;
    await Promise.race([
      api(ROTA, { method: 'POST', body: { acao: 'cancelar', endpoint: sub.endpoint } }).catch(() => {}),
      new Promise(ok => setTimeout(ok, 3000)),
    ]);
    await sub.unsubscribe();
  } catch {
    /* melhor esforço */
  }
}

// Uma vez por dia, com o app aberto: mantém o servidor em dia com a inscrição deste aparelho (ele pode ter perdido a linha,
// ou a chave do servidor pode ter sido trocada).
export async function sincronizarPush() {
  if (!suportaPush() || Notification.permission !== 'granted' || ler('smue:push') === hojeISO()) return;
  try {
    const reg = await registro();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (!sub) return;
    const { chave } = await api(ROTA);
    if (!chave) return;
    const bytes = chaveParaBytes(chave);
    let atual = sub;
    if (!mesmaChave(sub.options.applicationServerKey, bytes)) {
      await sub.unsubscribe();
      atual = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
    }
    await api(ROTA, { method: 'POST', body: { acao: 'assinar', assinatura: atual.toJSON() } });
    guardar('smue:push', hojeISO());
  } catch {
    /* tenta de novo na próxima abertura */
  }
}

export const acoes = { 'push-ativar': ({ b }) => ativar(b), 'push-desativar': ({ b }) => desativar(b), 'push-teste': ({ b }) => teste(b) };
