// Tela dos tops 10.
import { esc } from '../util.js';
import { L, achar } from '../loja.js';
import { capa } from './comum.js';

const SETA_CIMA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
const SETA_BAIXO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

/* ---------- tops ---------- */
export function viewTops() {
  const dl = `<datalist id="nomes">${L.series.map(s => `<option value="${esc(s.nome)}"></option>`).join('')}</datalist>`;
  const cards = L.tops
    .map((t, n) => {
      const li = t.itens
        .map((it, i) => {
          const s = it.sid ? achar(it.sid) : null;
          return `<li data-i="${i}"><button class="alca" data-alca aria-label="Arrastar ${esc(it.t)}, posição ${i + 1} de ${t.itens.length}. Setas para cima e para baixo também movem" aria-keyshortcuts="ArrowUp ArrowDown Home End" title="Arraste para reordenar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>
        <span class="n">${i + 1}</span><div class="p">${capa(it.t, s && s.capa)}</div><span class="t">${esc(it.t)}</span>
        <span class="mv"><span class="ord"><button type="button" data-act="sobe" aria-label="Subir ${esc(it.t)} (posição ${i + 1} de ${t.itens.length})"${i === 0 ? ' disabled' : ''}>${SETA_CIMA}</button><button type="button" data-act="desce" aria-label="Descer ${esc(it.t)} (posição ${i + 1} de ${t.itens.length})"${i === t.itens.length - 1 ? ' disabled' : ''}>${SETA_BAIXO}</button></span><button type="button" data-act="tira" aria-label="Remover ${esc(it.t)}">✕</button></span></li>`;
        })
        .join('');
      return `<section class="top" data-top="${esc(t.id)}" data-i="${Math.min(n, 8)}">
      <div class="top-cab"><h2>${esc(t.nome)}</h2><small>${t.itens.length}/10</small>${t.itens.length ? `<button class="btn sec mini" data-act="compartilhar">${L.links[t.id] ? 'Compartilhado' : 'Compartilhar'}</button>` : ''}<button class="btn sec perigo mini" data-act="del-top">Excluir</button></div>
      ${li ? `<ol>${li}</ol>` : '<p class="mut-peq">Lista vazia. Adicione seu primeiro título.</p>'}
      ${t.itens.length < 10 ? `<div class="add"><input type="text" list="nomes" maxlength="80" placeholder="Série ou filme" aria-label="Adicionar título"><button class="btn mini" data-act="add-item">Adicionar</button></div>` : ''}
    </section>`;
    })
    .join('');
  return `<div class="cabeca"><div><h1>Meus tops 10</h1>
    <p class="sub">Monte rankings do seu jeito. Arraste a alça ⋮⋮ ou use as setas ▲▼ para mudar a posição.</p></div></div>
    <div class="nova-top"><input type="text" id="nt" maxlength="60" placeholder="Nome do top (ex.: Melhores séries de 2026)" aria-label="Nome do novo top"><button class="btn" data-act="novo-top">Criar</button></div>
    ${L.tops.length ? `<div class="tops">${cards}</div>` : '<div class="vazio">Nenhum top criado ainda.</div>'}${dl}`;
}
