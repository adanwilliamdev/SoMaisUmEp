// Tela dos tops 10: o Hall da Fama pessoal (rankings seus, cada título com uma nota de rodapé íntima).
import { html, raw } from '../util.js';
import { L, achar } from '../loja.js';
import { capa } from './comum.js';
import { OBS_MAX } from '../regras.js';

const SETA_CIMA = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>');
const SETA_BAIXO = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>');

/* ---------- nota de rodapé de cada item ---------- */
// Texto (ou convite para escrever) e o campo de edição; telas/tops.js troca um pelo outro no lugar, sem redesenhar a lista.
export const htmlObs = it =>
  it.obs
    ? html`<button type="button" class="obs-txt" data-act="obs-edit" aria-label="Editar a nota de rodapé de ${it.t}: ${it.obs}">${it.obs}</button>`
    : html`<button type="button" class="obs-add" data-act="obs-edit" aria-label="Escrever uma nota de rodapé para ${it.t}">+ nota de rodapé</button>`;
export const htmlObsCampo = it =>
  html`<input type="text" class="obs-in" maxlength="${OBS_MAX}" value="${it.obs || ''}" placeholder="Ex.: Assisti em 2024, maratonei em um fim de semana" aria-label="Nota de rodapé de ${it.t}">`;

/* ---------- tops ---------- */
export function viewTops() {
  const dl = html`<datalist id="nomes">${L.series.map(s => html`<option value="${s.nome}"></option>`)}</datalist>`;
  const cards = L.tops.map((t, n) => {
    const li = t.itens.map((it, i) => {
      const s = it.sid ? achar(it.sid) : null;
      return html`<li data-i="${i}"><button class="alca" data-alca aria-label="Arrastar ${it.t}, posição ${i + 1} de ${t.itens.length}. Setas para cima e para baixo também movem" aria-keyshortcuts="ArrowUp ArrowDown Home End" title="Arraste para reordenar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>
        <span class="n">${i + 1}</span><div class="p">${capa(it.t, s && s.capa)}</div><span class="t">${it.t}</span>
        <span class="mv"><span class="ord"><button type="button" data-act="sobe" aria-label="Subir ${it.t} (posição ${i + 1} de ${t.itens.length})"${i === 0 ? ' disabled' : ''}>${SETA_CIMA}</button><button type="button" data-act="desce" aria-label="Descer ${it.t} (posição ${i + 1} de ${t.itens.length})"${i === t.itens.length - 1 ? ' disabled' : ''}>${SETA_BAIXO}</button></span><button type="button" data-act="tira" aria-label="Remover ${it.t}">✕</button></span>
        <div class="obs">${htmlObs(it)}</div></li>`;
    });
    return html`<section class="top" data-top="${t.id}" data-i="${Math.min(n, 8)}">
      <div class="top-cab"><h2>${t.nome}</h2><small>${t.itens.length}/10</small>${t.itens.length ? html`<button class="btn sec mini" data-act="compartilhar">${L.links[t.id] ? 'Compartilhado' : 'Compartilhar'}</button>` : ''}<button class="btn sec perigo mini" data-act="del-top">Excluir</button></div>
      ${t.itens.length ? html`<ol>${li}</ol>` : raw('<p class="mut-peq">Lista vazia. Adicione seu primeiro título.</p>')}
      ${t.itens.length < 10 ? html`<div class="add"><input type="text" list="nomes" maxlength="80" placeholder="Série ou filme" aria-label="Adicionar título"><button class="btn mini" data-act="add-item">Adicionar</button></div>` : ''}
    </section>`;
  });
  return html`<div class="cabeca"><div><h1>Meu Hall da Fama</h1>
    <p class="sub">Seus rankings, só com a sua opinião. Arraste para reordenar e deixe uma nota em cada título.</p></div></div>
    <div class="nova-top"><input type="text" id="nt" maxlength="60" placeholder="Nome do ranking (ex.: Melhores séries de 2026)" aria-label="Nome do novo ranking"><button class="btn" data-act="novo-top">Criar</button></div>
    ${L.tops.length ? html`<div class="tops">${cards}</div>` : raw('<div class="vazio">Seu Hall da Fama está vazio. Crie o primeiro ranking acima.</div>')}${dl}`;
}
