// Estante de séries e filmes: cards, "Continuar assistindo", próximos lançamentos, filtros e lista.
import { esc, hue } from '../util.js';
import { L } from '../loja.js';
import { tp, tot, vis, estado, prox, pct, rotulo, filtrar, ordenar, continuar, ORDENS, lancamento, proximosLancamentos } from '../regras.js';
import { UI, capa, ICO_MAIS, ICO_OK } from './comum.js';

// Selo "Novo ep sexta" / "Estreia em 12 nov" (some sozinho quando a data passa).
const chipLanc = s => {
  const l = lancamento(s);
  return l ? `<span class="lanc${l.dias <= 1 ? ' perto' : ''}">${esc(l.texto)}</span>` : '';
};

export function cardHtml(s, n = 0) {
  const mv = tp(s) === 'movie',
    p = pct(s),
    prx = prox(s),
    est = estado(s);
  const chip = est === 'fim' ? '<span class="sel ok">Concluído</span>' : '';
  return `<article class="card" data-id="${esc(s.id)}" data-est="${est}" data-i="${Math.min(n, 14)}">
      <div class="poster">
        <button class="capa" data-act="abrir" aria-label="Abrir ${esc(s.nome)}">${capa(s.nome, s.capa)}${chip}${s.nota_pessoal != null ? `<span class="sel dir" title="Minha nota">★ ${s.nota_pessoal}</span>` : ''}</button>
        ${prx ? `<button class="mais" data-act="mais" aria-label="${mv ? 'Marcar ' + esc(s.nome) + ' como visto' : '+1 episódio de ' + esc(s.nome)}" title="${mv ? 'Marcar como visto' : '+1 episódio'}">${mv ? ICO_OK : ICO_MAIS + '<b>1</b>'}</button>` : ''}
      </div>
      ${mv ? '' : `<div class="linha" aria-hidden="true"><i data-w="${p}"></i></div>`}
      <h3>${esc(s.nome)}</h3><small>${rotulo(s)}${mv && s.ano ? ' · ' + esc(s.ano) : ''}</small>${chipLanc(s)}
    </article>`;
}

// Fileira "Continuar assistindo": o primeiro título é o destaque (o que você viu por último); os outros viram linhas compactas.
export function cardContinuar(s, n = 0) {
  const p = pct(s),
    prx = prox(s);
  const botao = (cls, miolo) =>
    prx ? `<button class="mais ${cls}" data-act="mais" aria-label="+1 episódio de ${esc(s.nome)}" title="+1 episódio">${miolo}</button>` : '';
  if (n > 0) {
    return `<article class="card cc" data-id="${esc(s.id)}" data-est="${estado(s)}" data-i="${Math.min(n, 14)}">
      <button class="capa" data-act="abrir" aria-label="Abrir ${esc(s.nome)}">${capa(s.nome, s.capa)}</button>
      <div class="cc-info"><h3>${esc(s.nome)}</h3>
        <small>${prx ? `T${prx[0]} · E${prx[1]}` : ''}</small>${chipLanc(s)}
        <div class="linha" aria-hidden="true"><i data-w="${p}"></i></div></div>
      ${botao('', ICO_MAIS + '<b>1</b>')}
    </article>`;
  }
  const urlFundo = s.capa && /^https:\/\/[\w./:+=%?&,~@-]+$/.test(s.capa);
  return `<article class="card cc cc-hero" data-id="${esc(s.id)}" data-est="${estado(s)}" data-i="0">
      <div class="cc-fundo" aria-hidden="true" ${urlFundo ? `data-cover="${esc(s.capa)}"` : `data-h="${hue(s.nome)}"`}></div>
      <button class="capa" data-act="abrir" aria-label="Abrir ${esc(s.nome)}">${capa(s.nome, s.capa, true)}</button>
      <div class="cc-info"><h3>${esc(s.nome)}</h3>
        <p class="cc-ep">${prx ? `T${prx[0]} E${prx[1]}` : ''}</p>
        <div class="linha" aria-hidden="true"><i data-w="${p}"></i></div>
        <small>Próximo episódio: ${vis(s)} de ${tot(s)} vistos</small>${chipLanc(s)}</div>
      ${botao('mais-grande', '<span class="mais-n" aria-hidden="true">+1</span><span>Só mais um ep</span>')}
    </article>`;
}

export const listaDe = tipo =>
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
  return stats.map(([n, r]) => `<div class="stat"><b>${n}</b><span>${r}</span></div>`).join('');
}

// "Próximos lançamentos": o que sai nas próximas semanas entre os títulos da estante (série ou filme, conforme a aba).
export function htmlProximos(tipo) {
  if (UI.busca) return '';
  const lista = proximosLancamentos(L.series, { tipo });
  if (!lista.length) return '';
  const mv = tipo === 'movie';
  return `<section class="prox" aria-labelledby="t-prox"><h2 class="sec-tit" id="t-prox">${mv ? 'Próximas estreias' : 'Próximos episódios'}</h2>
    <ul class="prox-lista">${lista
      .map(
        ({ s, l }) => `<li class="prox-i${l.hoje ? ' hoje' : ''}" data-id="${esc(s.id)}">
      <button class="prox-b" data-act="abrir" aria-label="Abrir ${esc(s.nome)}"><span class="prox-data" aria-hidden="true"><b>${l.dia}</b>${esc(l.mes)}</span>
      <span class="prox-txt"><b>${esc(s.nome)}</b><small>${l.t && l.e ? `T${l.t} · E${l.e} · ` : ''}${esc(l.quando)}</small></span></button></li>`,
      )
      .join('')}</ul></section>`;
}

export function htmlContinuar(tipo) {
  if (tipo !== 'tv' || UI.busca) return '';
  const c = continuar(L.series);
  if (!c.length) return '';
  const [destaque, ...resto] = c;
  return `<section class="fila" aria-labelledby="t-fila"><h2 class="sec-tit" id="t-fila">Continuar assistindo</h2>
    <div class="fila-grade${resto.length ? '' : ' so-um'}">${cardContinuar(destaque, 0)}${resto.length ? `<div class="fila-resto">${resto.map((s, n) => cardContinuar(s, n + 1)).join('')}</div>` : ''}</div></section>`;
}

const VAZIO_ICO =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9h18M8 5l-2 4M13 5l-2 4M18 5l-2 4"/></svg>';
export function htmlLista(tipo) {
  const mv = tipo === 'movie',
    lista = listaDe(tipo),
    total = L.series.filter(s => tp(s) === tipo).length;
  if (lista.length) return `<div class="grade">${lista.map((s, n) => cardHtml(s, n)).join('')}</div>`;
  if (UI.busca) return `<div class="vazio">${VAZIO_ICO}<p>Nada encontrado para “${esc(UI.busca)}”.</p></div>`;
  if (total) return `<div class="vazio">${VAZIO_ICO}<p>Nada neste filtro.</p></div>`;
  return `<div class="vazio">${VAZIO_ICO}<p><b>${mv ? 'Nenhum filme ainda' : 'Sua estante está vazia'}</b><br>${mv ? 'Registre o primeiro filme que você viu.' : 'Adicione a primeira série e marque o episódio de hoje.'}</p>
    <button class="btn" data-act="nova" data-tipo="${tipo}">${mv ? '+ Adicionar filme' : '+ Adicionar série'}</button>
    <button class="link" data-act="importar-abrir">Já usa Trakt, Letterboxd ou IMDb? Importe sua lista</button></div>`;
}

const LUPA = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
export function viewLista(tipo) {
  const mv = tipo === 'movie';
  const fs = mv
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
      ];
  if (!fs.some(([k]) => k === UI.filtro)) UI.filtro = 'todas';
  const chips = fs.map(([k, r]) => `<button class="chip" data-act="filtro" data-k="${k}" aria-pressed="${UI.filtro === k}">${r}</button>`).join('');
  return `<div class="cabeca"><div><h1>${mv ? 'Meus filmes' : 'Minhas séries'}</h1>
      <p class="sub">${mv ? 'Registre o que você já viu e o que quer ver.' : 'Acompanhe cada temporada e episódio.'}</p></div>
      <button class="btn nova" data-act="nova" data-tipo="${tipo}"><span aria-hidden="true">+</span><span class="rot">${mv ? 'Novo filme' : 'Nova série'}</span></button></div>
    <div class="stats" id="stats">${htmlStats(tipo)}</div>
    <div id="proximos">${htmlProximos(tipo)}</div>
    <div id="continuar">${htmlContinuar(tipo)}</div>
    <div class="ferramentas">
      <div class="barra-acoes" role="group" aria-label="Filtrar por estado">${chips}</div>
      <label class="busca"><span class="sr">Buscar por nome</span>${LUPA}<input type="search" id="busca" placeholder="Buscar por nome" value="${esc(UI.busca)}" autocomplete="off" enterkeyhint="search"></label>
      <label class="ordem"><span class="sr">Ordenar por</span><select id="ordem" aria-label="Ordenar por">${ORDENS.map(([k, r]) => `<option value="${k}" ${UI.ordem === k ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    </div>
    <div id="lista">${htmlLista(tipo)}</div>`;
}
