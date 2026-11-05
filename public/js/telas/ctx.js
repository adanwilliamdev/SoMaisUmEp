// Estado e atalhos compartilhados pelas telas. Cada tela fica em seu módulo (telas/*.js) e conversa com as outras
// só por aqui: `ctx` guarda o estado, `gancho` guarda funções que o main.js liga ao iniciar (evita módulos que se importam em círculo).
import { $ } from '../util.js';

export const app = $('#app');
export const dlg = $('#dlg');

// O diálogo é reescrito a cada tela (innerHTML): o primeiro <h2> vira o nome dele para os leitores de tela.
new MutationObserver(() => {
  const h = dlg.querySelector('h2');
  if (h) {
    h.id = 'dlg-titulo';
    dlg.setAttribute('aria-labelledby', 'dlg-titulo');
  } else dlg.removeAttribute('aria-labelledby');
}).observe(dlg, { childList: true });

export const ctx = {
  logado: false,
  aberta: null, // id do título aberto no painel de detalhes
  animar: true, // anima só ao trocar de aba, não a cada +1 episódio
};

// Preenchido por main.js.
export const gancho = {
  render() {},
  pintaDetalhe() {},
  telaAuth() {},
  iniciar() {},
};

// Cache da tela "Onde assistir": id -> 'carregando' | 'erro' | dados | null
export const onde = {};
export const limparOnde = () => {
  for (const k in onde) delete onde[k];
};

/* ---------- abas ---------- */
export const aba = () => (['#tops', '#filmes', '#stats', '#descobrir'].includes(location.hash) ? location.hash : '#series');
export const tipoAtual = () => (aba() === '#filmes' ? 'movie' : 'tv');
export const naLista = () => aba() === '#series' || aba() === '#filmes';

// Imagens entram com fade quando terminam de carregar.
export function revela() {
  document.querySelectorAll('img.fade:not(.ok)').forEach(i => {
    if (i.complete && i.naturalWidth) i.classList.add('ok');
  });
}
