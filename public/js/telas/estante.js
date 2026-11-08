// Estante (séries e filmes): atualização parcial da tela, marcação de progresso e eventos da lista.
import { $, avisoDesfazer, guardar } from '../util.js';
import { achar, save } from '../loja.js';
import { tp, vis, estado, prox, registrarProgresso } from '../regras.js';
import * as V from '../views.js';
import { app, dlg, ctx, gancho, tipoAtual, naLista, revela } from './ctx.js';

// Atualiza só a lista (busca, filtro, ordem) sem mexer no campo de busca nem na rolagem.
export function renderLista(anim = false) {
  if (!naLista() || !$('#lista')) return gancho.render();
  const t = tipoAtual();
  app.classList.toggle('entra', anim);
  $('#stats').innerHTML = V.htmlStats(t);
  $('#proximos').innerHTML = V.htmlProximos(t);
  $('#continuar').innerHTML = V.htmlContinuar(t);
  $('#lista').innerHTML = V.htmlLista(t);
  document.querySelectorAll('[data-act="filtro"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === V.UI.filtro));
  revela();
}

// Dá retorno ao toque: a barra de progresso corre do valor antigo ao novo e a capa dá um leve "toque". Respeita "reduzir movimento".
function animarCard(card, de) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ease = 'cubic-bezier(.2,.8,.2,1)',
    barra = card.querySelector('.linha i'),
    ate = barra && barra.dataset.w;
  if (barra && barra.animate && de != null && de !== ate) barra.animate([{ width: de + '%' }, { width: ate + '%' }], { duration: 520, easing: ease });
  const capa = card.querySelector('.capa'),
    ep = card.querySelector('.cc-ep');
  if (capa && capa.animate) capa.animate([{ transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: 300, easing: ease });
  if (ep && ep.animate) ep.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 340, easing: ease });
}

// Troca só o(s) card(s) do título alterado (e os números do topo). Se o estado mudou, o filtro pode mudar: refaz a lista.
export function patchCard(id, mudouEstado) {
  if (!naLista() || !$('#stats')) return;
  if (mudouEstado) return renderLista();
  const s = achar(id);
  if (!s) return;
  $('#stats').innerHTML = V.htmlStats(tipoAtual());
  document.querySelectorAll(`.card[data-id="${CSS.escape(String(id))}"]`).forEach(el => {
    const t = document.createElement('template');
    const antes = el.querySelector('.linha i');
    t.innerHTML = (el.classList.contains('cc') ? V.cardContinuar : V.cardHtml)(s, +el.style.getPropertyValue('--i') || 0);
    const novo = t.content.firstElementChild;
    el.replaceWith(novo);
    animarCard(novo, antes && antes.dataset.w);
  });
  revela();
}

// Marca progresso: registra histórico, salva e atualiza só o que mudou na tela.
// `rotuloDesfazer`: texto do aviso com botão "Desfazer" (só fora do painel de detalhes, onde o aviso ficaria atrás dele).
export function mexer(s, fn, rotuloDesfazer) {
  const antes = vis(s),
    est = estado(s),
    ant = { vis: [...s.vis], visto_em: s.visto_em, hist: s.hist };
  fn();
  registrarProgresso(s, antes);
  save();
  patchCard(s.id, est !== estado(s));
  if (ctx.aberta === s.id) gancho.pintaDetalhe();
  if (rotuloDesfazer && !dlg.open)
    avisoDesfazer(rotuloDesfazer, () => {
      const x = achar(s.id);
      if (!x) return; // foi excluído nesse meio tempo
      const e0 = estado(x);
      x.vis = ant.vis;
      for (const k of ['visto_em', 'hist']) {
        if (ant[k] === undefined) delete x[k];
        else x[k] = ant[k];
      }
      save();
      patchCard(x.id, e0 !== estado(x));
    });
}

/* ---------- eventos ---------- */
// Cada ação recebe { b, id, s, t, tid, i }: botão clicado, id do card, título, top, id do top e posição na lista.
export const acoes = {
  filtro: ({ b }) => {
    V.UI.filtro = b.dataset.k;
    renderLista(true);
  },
  mais: ({ s }) => {
    const p = s && prox(s);
    if (!p) return;
    if (navigator.vibrate) navigator.vibrate(8); // toque curto no celular (onde há suporte)
    mexer(
      s,
      () => {
        s.vis[p[0] - 1]++;
      },
      tp(s) === 'movie' ? `${s.nome} marcado como visto` : `${s.nome}: T${p[0]} E${p[1]} marcado`,
    );
  },
  ep: ({ b, s }) => {
    if (!s) return;
    const k = +b.dataset.s,
      n = +b.dataset.e;
    mexer(s, () => {
      s.vis[k] = s.vis[k] === n ? n - 1 : n;
    });
  },
  'temp-tudo': ({ b, s }) => {
    if (s)
      mexer(s, () => {
        s.vis[+b.dataset.s] = s.eps[+b.dataset.s];
      });
  },
  'temp-zero': ({ b, s }) => {
    if (s)
      mexer(s, () => {
        s.vis[+b.dataset.s] = 0;
      });
  },
  visto: ({ s }) => {
    if (s)
      mexer(s, () => {
        s.vis[0] = s.vis[0] ? 0 : 1;
      });
  },
};

document.addEventListener('input', e => {
  if (e.target.id === 'busca') {
    V.UI.busca = e.target.value;
    renderLista();
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'ordem') {
    V.UI.ordem = e.target.value;
    guardar('smue:ordem', V.UI.ordem);
    renderLista(true);
  }
});
