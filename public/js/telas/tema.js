// Tema claro/escuro.
import { $, guardar, ler } from '../util.js';

const SOL =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const LUA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

const escuro = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';

export function pintaTema() {
  const b = $('#tema'),
    d = escuro();
  b.innerHTML = d ? SOL : LUA;
  b.setAttribute('aria-label', d ? 'Mudar para o tema claro' : 'Mudar para o tema escuro');
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = d ? '#120f1e' : '#f1eef8';
}

function alternarTema() {
  const novo = escuro() ? 'light' : 'dark';
  document.documentElement.dataset.theme = novo;
  guardar('smue:tema', novo);
  pintaTema();
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!ler('smue:tema')) pintaTema();
});

export const acoes = { tema: alternarTema };
