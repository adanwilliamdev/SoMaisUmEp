// Peças de HTML usadas por mais de uma tela: estado da interface (UI), capa/placeholder, esqueleto de carregamento e ícones.
import { esc, hue, ler } from '../util.js';

export const UI = { filtro: 'todas', busca: '', ordem: ler('smue:ordem', 'recente'), descTipo: 'tv' };

export const capa = (nome, img, urgente) =>
  img
    ? `<img class="fade" src="${esc(img)}" alt="" decoding="async" ${urgente ? 'fetchpriority="high"' : 'loading="lazy"'}>`
    : `<div class="ph" data-h="${hue(nome)}"><span>${esc((String(nome).trim()[0] || '?').toUpperCase())}</span></div>`;

export function esqueleto(hash) {
  const caixa = n =>
    Array.from({ length: n }, () => '<div><div class="sk sk-capa"></div><div class="sk sk-l1"></div><div class="sk sk-l2"></div></div>').join('');
  const corpo =
    hash === '#tops'
      ? '<div class="tops"><div class="sk sk-top"></div><div class="sk sk-top"></div></div>'
      : `<div class="stats"><div class="sk sk-stat"></div></div><div class="grade">${caixa(8)}</div>`;
  return `<div aria-busy="true"><span class="sr" role="status">Carregando…</span><div class="sk sk-h1"></div><div class="sk sk-sub"></div>${corpo}</div>`;
}

export const ICO_MAIS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
export const ICO_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
