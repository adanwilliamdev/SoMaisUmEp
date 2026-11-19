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

// Clicar fora do painel (no fundo escurecido) fecha. Só vale se o clique também COMEÇOU fora (selecionar texto e soltar fora não fecha)
// e nunca em painéis com formulário (Editar, Entrar, Trocar senha...), para ninguém perder o que digitou sem querer.
{
  let comecouFora = false;
  const fora = e => {
    const r = dlg.getBoundingClientRect();
    return e.target === dlg && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
  };
  dlg.addEventListener('pointerdown', e => {
    comecouFora = fora(e);
  });
  dlg.addEventListener('click', e => {
    if (comecouFora && fora(e) && !dlg.querySelector('form')) dlg.close();
    comecouFora = false;
  });
}

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

/* ---------- carrosséis ---------- */
// Cada faixa rolável ("Continuar assistindo", "Próximos episódios") mostra a seta e o esmaecimento só do lado em que ainda há itens.
// O CSS lê as classes .m-esq / .m-dir; o atributo hidden esconde a seta que não leva a lugar nenhum.
const FOLGA = 4;
function marcaCarrossel(c) {
  const t = c.querySelector(':scope > .fila-trilho, :scope > .prox-lista');
  if (!t) return;
  const esq = t.scrollLeft > FOLGA,
    dir = t.scrollLeft + t.clientWidth < t.scrollWidth - FOLGA;
  c.classList.toggle('m-esq', esq);
  c.classList.toggle('m-dir', dir);
  const [be, bd] = [c.querySelector(':scope > .seta.esq'), c.querySelector(':scope > .seta.dir')];
  if (be) be.hidden = !esq;
  if (bd) bd.hidden = !dir;
}
export const marcaCarrosseis = () => document.querySelectorAll('.carrossel').forEach(marcaCarrossel);
// "scroll" não borbulha: a captura pega a rolagem de qualquer faixa com um único ouvinte.
document.addEventListener(
  'scroll',
  e => {
    const c = e.target.closest && e.target.closest('.carrossel');
    if (c) marcaCarrossel(c);
  },
  { capture: true, passive: true },
);
addEventListener('resize', marcaCarrosseis);

// Depois de cada tela desenhada: imagens já carregadas entram com fade e os carrosséis acertam as setas.
export function revela() {
  document.querySelectorAll('img.fade:not(.ok)').forEach(i => {
    if (i.complete && i.naturalWidth) i.classList.add('ok');
  });
  marcaCarrosseis();
}

// Teclado virtual: a gaveta acompanha a área realmente visível e o campo em foco rola para a vista,
// assim "Salvar/Cancelar" não ficam escondidos atrás do teclado.
{
  const vv = window.visualViewport;
  const ajusta = () => document.documentElement.style.setProperty('--vvh', (vv ? vv.height : window.innerHeight) + 'px');
  if (vv) {
    vv.addEventListener('resize', ajusta);
    vv.addEventListener('scroll', ajusta);
  }
  ajusta();
  dlg.addEventListener('focusin', e => {
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  });
}
