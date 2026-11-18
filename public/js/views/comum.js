// Peças de HTML usadas por mais de uma tela: estado da interface (UI), capa/placeholder, esqueleto de carregamento e ícones.
import { html, raw, hue, ler, lerJSON } from '../util.js';

export const UI = { filtro: 'todas', busca: '', ordem: ler('smue:ordem', 'recente'), descTipo: 'tv', fechados: new Set(lerJSON('smue:grupos', [])) }; // fechados: grupos recolhidos da estante

export const capa = (nome, img, urgente) =>
  img
    ? html`<img class="fade" src="${img}" alt="" decoding="async" ${raw(urgente ? 'fetchpriority="high"' : 'loading="lazy"')}>`
    : html`<div class="ph" data-h="${hue(nome)}"><span>${(String(nome).trim()[0] || '?').toUpperCase()}</span></div>`;

export function esqueleto(hash) {
  const caixa = n => Array.from({ length: n }, () => raw('<div><div class="sk sk-capa"></div><div class="sk sk-l1"></div><div class="sk sk-l2"></div></div>'));
  const corpo =
    hash === '#tops'
      ? raw('<div class="tops"><div class="sk sk-top"></div><div class="sk sk-top"></div></div>')
      : html`<div class="stats"><div class="sk sk-stat"></div></div><div class="grade">${caixa(8)}</div>`;
  return html`<div aria-busy="true"><span class="sr" role="status">Carregando…</span><div class="sk sk-h1"></div><div class="sk sk-sub"></div>${corpo}</div>`;
}

// Ícones fixos (SVG escrito aqui no código): marcados como HTML seguro para entrar em html`` sem serem escapados.
export const ICO_MAIS = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>');
export const ICO_MENOS = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>');
export const ICO_OK = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>');
