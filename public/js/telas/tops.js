// Tops 10 (Hall da Fama): criar, adicionar/remover itens, reordenar (arrastar pela alça ou pelo teclado) e notas de rodapé.
import { $, uid, aviso, anunciar, avisoDesfazer, confirma } from '../util.js';
import { L, save } from '../loja.js';
import { gancho } from './ctx.js';
import { htmlObs, htmlObsCampo } from '../views/tops.js';
import { OBS_MAX } from '../regras.js';

function addItem(tid) {
  const t = L.tops.find(x => x.id === tid),
    inp = document.querySelector(`[data-top="${CSS.escape(String(tid))}"] input`);
  const v = inp.value.trim();
  if (!v || t.itens.length >= 10) return;
  const m = L.series.find(s => s.nome.toLowerCase() === v.toLowerCase());
  t.itens.push(m ? { t: m.nome, sid: m.id } : { t: v });
  save();
  gancho.render();
  const novo = document.querySelector(`[data-top="${CSS.escape(String(tid))}"] .add input`);
  if (novo) novo.focus();
}

const moverItem = (t, de, para) => {
  const [x] = t.itens.splice(de, 1);
  t.itens.splice(para, 0, x);
  save();
  anunciar(`${x.t} movido para a posição ${para + 1} de ${t.itens.length}`);
};

// Depois de mover (a tela é redesenhada), o foco volta ao mesmo item, no botão que o usuário estava usando.
const focarItem = (t, pos, qual) => {
  const li = document.querySelector(`[data-top="${CSS.escape(String(t.id))}"] li[data-i="${pos}"]`);
  if (!li) return;
  const alvo =
    li.querySelector(qual === 'alca' ? '[data-alca]' : `[data-act="${qual}"]:not(:disabled)`) ||
    li.querySelector('[data-act="sobe"]:not(:disabled), [data-act="desce"]:not(:disabled), [data-alca]');
  if (alvo) alvo.focus();
};

/* ---------- arrastar pela alça (mouse, toque e caneta) ---------- */
let arr = null;
export const arrastando = () => !!arr;

document.addEventListener('pointerdown', e => {
  const h = e.target.closest('[data-alca]');
  if (!h || e.button > 0) return;
  const li = h.closest('li'),
    ol = li.parentElement;
  arr = { li, ol, de: [...ol.children].indexOf(li), id: e.pointerId };
  li.classList.add('arrastando');
  h.setPointerCapture(e.pointerId);
  e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!arr || e.pointerId !== arr.id) return;
  let ref = null;
  for (const o of [...arr.ol.children].filter(x => x !== arr.li)) {
    const r = o.getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) {
      ref = o;
      break;
    }
  }
  if (ref !== arr.li.nextElementSibling) arr.ol.insertBefore(arr.li, ref);
});
const soltar = e => {
  if (!arr || e.pointerId !== arr.id) return;
  const { li, ol, de } = arr;
  arr = null;
  li.classList.remove('arrastando');
  const para = [...ol.children].indexOf(li),
    t = L.tops.find(x => x.id === li.closest('[data-top]').dataset.top);
  if (t && para !== de && para >= 0) moverItem(t, de, para);
  gancho.render();
};
document.addEventListener('pointerup', soltar);
document.addEventListener('pointercancel', soltar);

/* ---------- teclado ---------- */
document.addEventListener('keydown', e => {
  const alca = e.target.closest && e.target.closest('[data-alca]');
  if (alca && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    // reordenar pelo teclado
    e.preventDefault();
    const li = alca.closest('li'),
      topo = alca.closest('[data-top]'),
      t = L.tops.find(x => x.id === topo.dataset.top);
    const de = +li.dataset.i,
      para = de + (e.key === 'ArrowUp' ? -1 : 1);
    if (!t || para < 0 || para >= t.itens.length) return;
    moverItem(t, de, para);
    gancho.render();
    focarItem(t, para, 'alca');
    return;
  }
  if (alca && (e.key === 'Home' || e.key === 'End')) {
    // primeiro / último lugar
    e.preventDefault();
    const li = alca.closest('li'),
      t = L.tops.find(x => x.id === alca.closest('[data-top]').dataset.top);
    const de = +li.dataset.i,
      para = e.key === 'Home' ? 0 : t.itens.length - 1;
    if (!t || para === de) return;
    moverItem(t, de, para);
    gancho.render();
    focarItem(t, para, 'alca');
    return;
  }
  if (e.key !== 'Enter') return;
  if (e.target.matches('.add input')) {
    e.preventDefault();
    addItem(e.target.closest('[data-top]').dataset.top);
  } else if (e.target.id === 'nt') {
    e.preventDefault();
    document.querySelector('[data-act="novo-top"]').click();
  }
});

function deslocar(t, de, passo, b) {
  const para = de + passo;
  if (!t || de < 0 || para < 0 || para >= t.itens.length) return;
  moverItem(t, de, para);
  gancho.render();
  focarItem(t, para, b.dataset.act);
}

/* ---------- nota de rodapé ---------- */
const itemDoCampo = campo => {
  const li = campo.closest('li'),
    topo = campo.closest('[data-top]'),
    t = topo && L.tops.find(x => x.id === topo.dataset.top);
  return { t, it: t && li ? t.itens[+li.dataset.i] : null, caixa: campo.closest('.obs') };
};
// Fecha o campo (salvando ou não) e volta ao texto, sem redesenhar a lista (o resto da tela não mexe).
function fecharObs(campo, salvar, devolverFoco = false) {
  if (campo.dataset.fim) return;
  campo.dataset.fim = '1';
  const { it, caixa } = itemDoCampo(campo);
  if (!it || !caixa) return;
  if (salvar) {
    const v = campo.value.trim().slice(0, OBS_MAX);
    if ((it.obs || '') !== v) {
      if (v) it.obs = v;
      else delete it.obs;
      save();
      anunciar(v ? `Nota de rodapé de ${it.t} salva` : `Nota de rodapé de ${it.t} removida`);
    }
  }
  caixa.innerHTML = htmlObs(it);
  if (devolverFoco) caixa.querySelector('button').focus();
}
document.addEventListener('focusout', e => {
  if (e.target.matches && e.target.matches('.obs-in')) fecharObs(e.target, true);
});
document.addEventListener('keydown', e => {
  if (!e.target.matches || !e.target.matches('.obs-in')) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    fecharObs(e.target, true, true);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation(); // não fecha nada além do campo
    fecharObs(e.target, false, true);
  }
});

/* ---------- eventos ---------- */
export const acoes = {
  'obs-edit': ({ t, i, b }) => {
    const it = t && t.itens[i],
      caixa = b.closest('.obs');
    if (!it || !caixa) return;
    caixa.innerHTML = htmlObsCampo(it);
    const campo = caixa.querySelector('input');
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
  },
  'novo-top': () => {
    const v = $('#nt').value.trim();
    if (!v) return;
    L.tops.unshift({ id: uid(), criado: Date.now(), nome: v, itens: [] });
    save();
    gancho.render();
  },
  'del-top': ({ b, t, tid }) => {
    if (!t) return;
    confirma(b, () => {
      const pos = L.tops.indexOf(t),
        codigo = L.links[tid];
      L.tops = L.tops.filter(x => x.id !== tid);
      delete L.links[tid];
      save();
      gancho.render();
      avisoDesfazer(
        `Top “${t.nome}” excluído${codigo ? ' (o link público foi desligado)' : ''}`,
        () => {
          L.tops.splice(Math.min(pos, L.tops.length), 0, t);
          save();
          gancho.render();
        },
        9000,
      );
    });
  },
  // Subir/descer por botão: alternativa a arrastar (toque, leitor de tela, quem não consegue segurar e mover).
  sobe: ({ t, i, b }) => deslocar(t, i, -1, b),
  desce: ({ t, i, b }) => deslocar(t, i, 1, b),
  'add-item': ({ t, tid }) => {
    if (t) addItem(tid);
  },
  tira: ({ t, i }) => {
    if (!t) return;
    const [item] = t.itens.splice(i, 1);
    save();
    gancho.render();
    avisoDesfazer(`${item.t} removido do top`, () => {
      if (!L.tops.includes(t)) return;
      if (t.itens.length >= 10) {
        aviso('O top já está cheio.');
        return;
      }
      t.itens.splice(Math.min(i, t.itens.length), 0, item);
      save();
      gancho.render();
    });
  },
};
