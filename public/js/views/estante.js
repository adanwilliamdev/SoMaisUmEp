// Estante de séries e filmes: cards, "Continuar assistindo", próximos lançamentos, filtros e lista.
import { html, raw, hue } from '../util.js';
import { L } from '../loja.js';
import {
  tp,
  tot,
  vis,
  estado,
  estadoLista,
  situacao,
  prox,
  pct,
  rotulo,
  filtrar,
  ordenar,
  continuar,
  ORDENS,
  lancamento,
  proximosLancamentos,
} from '../regras.js';
import { UI, capa, ICO_MAIS, ICO_MENOS, ICO_OK } from './comum.js';

// Segmentos da faixa de episódios: um por episódio, no máximo 40.
const segs = s => Math.max(1, Math.min(tot(s), 40));

// Selo "Novo ep sexta" / "Estreia em 12 nov" (some sozinho quando a data passa).
const chipLanc = s => {
  const l = lancamento(s);
  return l ? html`<span class="lanc${l.dias <= 1 ? ' perto' : ''}">${l.texto}</span>` : '';
};

export function cardHtml(s, n = 0, agrupado = false) {
  const mv = tp(s) === 'movie',
    p = pct(s),
    prx = prox(s),
    est = estado(s);
  const sit = situacao(s);
  // Selo de estado só na lista plana (busca ou filtro): dentro de um grupo, o título da seção já diz o estado.
  const chip = agrupado
    ? ''
    : est === 'fim'
      ? raw('<span class="sel ok">Concluído</span>')
      : sit
        ? html`<span class="sel pausa">${sit === 'pausada' ? 'Pausada' : 'Abandonada'}</span>`
        : est === 'quero'
          ? raw('<span class="sel fila">Na fila</span>')
          : '';
  const menos =
    !mv && vis(s) > 0 ? html`<button class="menos" data-act="menos" aria-label="−1 episódio de ${s.nome}" title="−1 episódio">${ICO_MENOS}</button>` : '';
  const prog = !mv && est === 'assistindo' ? ` · ${vis(s)}/${tot(s)} eps` : '';
  return html`<article class="card" data-id="${s.id}" data-est="${estadoLista(s)}" data-i="${Math.min(n, 14)}">
      <div class="poster">
        <button class="capa" data-act="abrir" aria-label="Abrir ${s.nome}">${capa(s.nome, s.capa)}${chip}${s.nota_pessoal != null ? html`<span class="sel dir" title="Minha nota">★ ${s.nota_pessoal}</span>` : ''}</button>
        ${menos}
        ${prx ? html`<button class="mais" data-act="mais" aria-label="${mv ? 'Marcar ' + s.nome + ' como visto' : '+1 episódio de ' + s.nome}" title="${mv ? 'Marcar como visto' : '+1 episódio'}">${mv ? ICO_OK : html`${ICO_MAIS}<b>1</b>`}</button>` : ''}
      </div>
      ${mv ? '' : html`<div class="linha" aria-hidden="true" data-n="${segs(s)}"><i class="${p >= 100 ? 'fim' : ''}" data-w="${p}"></i></div>`}
      <h3>${s.nome}</h3><small>${rotulo(s)}${prog}${mv && s.ano ? ' · ' + s.ano : ''}</small>${chipLanc(s)}
    </article>`;
}

// Carrossel "Continuar assistindo": o primeiro título é o destaque (o que você viu por último); os outros viram capas menores ao lado.
export function cardContinuar(s, n = 0) {
  const p = pct(s),
    prx = prox(s);
  const botao = (cls, miolo) =>
    prx ? html`<button class="mais ${cls}" data-act="mais" aria-label="+1 episódio de ${s.nome}" title="+1 episódio">${miolo}</button>` : '';
  if (n > 0) {
    return html`<article class="card cc cc-peq" data-id="${s.id}" data-est="${estado(s)}" data-i="${Math.min(n, 14)}">
      <div class="poster"><button class="capa" data-act="abrir" aria-label="Abrir ${s.nome}">${capa(s.nome, s.capa)}</button>${botao('', html`${ICO_MAIS}<b>1</b>`)}</div>
      <div class="linha" aria-hidden="true" data-n="${segs(s)}"><i class="${p >= 100 ? 'fim' : ''}" data-w="${p}"></i></div>
      <h3>${s.nome}</h3><small>${prx ? `T${prx[0]} · E${prx[1]}` : ''}</small>
    </article>`;
  }
  const urlFundo = s.capa && /^https:\/\/[\w./:+=%?&,~@-]+$/.test(s.capa);
  return html`<article class="card cc cc-hero" data-id="${s.id}" data-est="${estado(s)}" data-i="0">
      <div class="cc-fundo" aria-hidden="true" ${urlFundo ? html`data-cover="${s.capa}"` : html`data-h="${hue(s.nome)}"`}></div>
      <button class="capa" data-act="abrir" aria-label="Abrir ${s.nome}">${capa(s.nome, s.capa, true)}</button>
      <div class="cc-info"><h3>${s.nome}</h3>
        <p class="cc-ep">${prx ? `T${prx[0]} E${prx[1]}` : ''}</p>
        <div class="linha" aria-hidden="true" data-n="${segs(s)}"><i class="${p >= 100 ? 'fim' : ''}" data-w="${p}"></i></div>
        <small>${vis(s)} de ${tot(s)} episódios vistos</small></div>
      ${botao('mais-grande', raw('<span class="mais-n" aria-hidden="true">+1</span><span>Só mais um ep</span>'))}
    </article>`;
}

const listaDe = tipo =>
  ordenar(
    filtrar(
      L.series.filter(s => tp(s) === tipo),
      { estado: UI.filtro, busca: UI.busca },
    ),
    UI.ordem,
  );

export function htmlStats(tipo) {
  const mv = tipo === 'movie',
    Ls = L.series.filter(s => tp(s) === tipo);
  const fim = Ls.filter(s => estado(s) === 'fim').length,
    eps = Ls.reduce((a, s) => a + vis(s), 0);
  const stats = mv
    ? [
        [Ls.length, 'filmes'],
        [fim, 'assistidos'],
        [Ls.length - fim, 'na fila'],
      ]
    : [
        [Ls.length, 'séries'],
        [eps, 'episódios vistos'],
        [fim, 'concluídas'],
      ];
  return html`${stats.map(([n, r]) => html`<div class="stat"><b>${n}</b><span>${r}</span></div>`)}`;
}

// "Próximos lançamentos": o que sai nas próximas semanas entre os títulos da estante (série ou filme, conforme a aba).
export function htmlProximos(tipo) {
  if (UI.busca) return '';
  const lista = proximosLancamentos(L.series, { tipo });
  if (!lista.length) return '';
  const mv = tipo === 'movie';
  return html`<section class="prox" aria-labelledby="t-prox"><h2 class="sec-tit" id="t-prox">${mv ? 'Próximas estreias' : 'Próximos episódios'}</h2>
    <ul class="prox-lista">${lista.map(
      ({ s, l }) => html`<li class="prox-i${l.hoje ? ' hoje' : ''}" data-id="${s.id}">
      <button class="prox-b" data-act="abrir" aria-label="Abrir ${s.nome}"><span class="prox-data" aria-hidden="true"><b>${l.dia}</b>${l.mes}</span>
      <span class="prox-txt"><b>${s.nome}</b><small>${l.t && l.e ? `T${l.t} · E${l.e} · ` : ''}${l.quando}</small></span></button></li>`,
    )}</ul></section>`;
}

export function htmlContinuar(tipo) {
  if (tipo !== 'tv' || UI.busca) return '';
  const c = continuar(L.series);
  if (!c.length) return '';
  return html`<section class="fila" aria-labelledby="t-fila"><h2 class="sec-tit" id="t-fila">Continuar assistindo</h2>
    <div class="fila-trilho${c.length > 1 ? '' : ' so-um'}">${c.map((s, n) => cardContinuar(s, n))}</div></section>`;
}

const VAZIO_ICO = raw(
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9h18M8 5l-2 4M13 5l-2 4M18 5l-2 4"/></svg>',
);
// Grupos da aba "Todas": cada estado vira uma seção recolhível, com o contador no título.
const GRUPOS = {
  tv: [
    ['assistindo', 'Assistindo'],
    ['quero', 'Na fila'],
    ['pausada', 'Pausadas'],
    ['abandonada', 'Abandonadas'],
    ['fim', 'Concluídas'],
  ],
  movie: [
    ['quero', 'Na fila'],
    ['pausada', 'Pausados'],
    ['abandonada', 'Abandonados'],
    ['fim', 'Assistidos'],
  ],
};

function htmlGrupos(lista, tipo) {
  let n = 0;
  return html`${GRUPOS[tipo].map(([k, rot]) => {
    const g = lista.filter(s => estadoLista(s) === k);
    if (!g.length) return '';
    const aberto = !UI.fechados.has(k);
    return html`<details class="grupo" data-grupo="${k}"${aberto ? ' open' : ''}><summary><h2 class="sec-tit">${rot} <span class="grupo-n">${g.length}</span></h2></summary>
        <div class="grade">${g.map(s => cardHtml(s, n++, true))}</div></details>`;
  })}`;
}

export function htmlLista(tipo) {
  const mv = tipo === 'movie',
    lista = listaDe(tipo),
    total = L.series.filter(s => tp(s) === tipo).length;
  if (lista.length) {
    // Sem busca e em "Todas", agrupa por estado. Com busca ou filtro específico, é uma grade só.
    if (UI.filtro === 'todas' && !UI.busca) return htmlGrupos(lista, tipo);
    return html`<div class="grade">${lista.map((s, n) => cardHtml(s, n))}</div>`;
  }
  if (UI.busca) return html`<div class="vazio">${VAZIO_ICO}<p>Nada encontrado para “${UI.busca}”.</p></div>`;
  if (total) return html`<div class="vazio">${VAZIO_ICO}<p>Nada neste filtro.</p></div>`;
  return html`<div class="vazio">${VAZIO_ICO}<p><b>${mv ? 'Nenhum filme ainda' : 'Sua estante está vazia'}</b><br>${mv ? 'Registre o primeiro filme que você viu.' : 'Adicione a primeira série e marque o episódio de hoje.'}</p>
    <button class="btn" data-act="nova" data-tipo="${tipo}">${mv ? '+ Adicionar filme' : '+ Adicionar série'}</button>
    <button class="link" data-act="importar-abrir">Já usa Trakt, Letterboxd ou IMDb? Importe sua lista</button></div>`;
}

const LUPA = raw('<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>');
export function viewLista(tipo) {
  const mv = tipo === 'movie';
  const fs = (
    mv
      ? [
          ['todas', 'Todos'],
          ['quero', 'Na fila'],
          ['fim', 'Assistidos'],
        ]
      : [
          ['todas', 'Todas'],
          ['assistindo', 'Assistindo'],
          ['quero', 'Na fila'],
          ['fim', 'Concluídas'],
        ]
  ).slice();
  // Pausadas e abandonadas só aparecem como filtro quando existe algo nessa situação (ou o filtro está ativo).
  for (const [k, rot] of mv
    ? [
        ['pausada', 'Pausados'],
        ['abandonada', 'Abandonados'],
      ]
    : [
        ['pausada', 'Pausadas'],
        ['abandonada', 'Abandonadas'],
      ]) {
    if (UI.filtro === k || L.series.some(s => tp(s) === tipo && situacao(s) === k)) fs.splice(fs.length - 1, 0, [k, rot]);
  }
  if (!fs.some(([k]) => k === UI.filtro)) UI.filtro = 'todas';
  const chips = fs.map(([k, r]) => html`<button class="chip" data-act="filtro" data-k="${k}" aria-pressed="${UI.filtro === k}">${r}</button>`);
  return html`<div class="estante"><div class="cabeca"><div><h1>${mv ? 'Meus filmes' : 'Minhas séries'}</h1>
      <p class="sub">${mv ? 'Registre o que você já viu e o que quer ver.' : 'Acompanhe cada temporada e episódio.'}</p></div>
      <button class="btn nova" data-act="nova" data-tipo="${tipo}"><span aria-hidden="true">+</span><span class="rot">${mv ? 'Novo filme' : 'Nova série'}</span></button></div>
    <div class="stats" id="stats">${htmlStats(tipo)}</div>
    <div id="continuar">${htmlContinuar(tipo)}</div>
    <div id="proximos">${htmlProximos(tipo)}</div>
    <div class="ferramentas">
      <div class="barra-acoes" role="group" aria-label="Filtrar por estado">${chips}</div>
      <div class="busca-ordem">
        <label class="busca"><span class="sr">Buscar por nome</span>${LUPA}<input type="search" id="busca" placeholder="Buscar por nome" value="${UI.busca}" autocomplete="off" enterkeyhint="search"></label>
        <label class="ordem"><span class="sr">Ordenar por</span><select id="ordem" aria-label="Ordenar por">${ORDENS.map(([k, r]) => html`<option value="${k}" ${UI.ordem === k ? 'selected' : ''}>${r}</option>`)}</select></label>
      </div>
    </div>
    <div id="lista">${htmlLista(tipo)}</div></div>`;
}
