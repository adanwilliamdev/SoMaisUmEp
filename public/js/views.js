// Funções que montam o HTML das telas (sem eventos). Os eventos ficam em main.js.
import { esc, hue, ler } from './util.js';
import { L, achar } from './loja.js';
import { tp, tot, vis, estado, prox, pct, rotulo, filtrar, ordenar, continuar, ORDENS, estatisticas, ultimosMeses, duracaoTexto } from './regras.js';

export const UI = { filtro: 'todas', busca: '', ordem: ler('claq:ordem', 'recente') };

export const capa = (nome, img, urgente) => img
  ? `<img class="fade" src="${esc(img)}" alt="" decoding="async" ${urgente ? 'fetchpriority="high"' : 'loading="lazy"'}>`
  : `<div class="ph" data-h="${hue(nome)}"><span>${esc((String(nome).trim()[0] || '?').toUpperCase())}</span></div>`;

export function esqueleto(hash) {
  const caixa = n => Array.from({ length: n }, () => '<div><div class="sk sk-capa"></div><div class="sk sk-l1"></div><div class="sk sk-l2"></div></div>').join('');
  const corpo = hash === '#tops'
    ? '<div class="tops"><div class="sk sk-top"></div><div class="sk sk-top"></div></div>'
    : `<div class="stats"><div class="sk sk-stat"></div></div><div class="grade">${caixa(8)}</div>`;
  return `<div aria-busy="true"><span class="sr" role="status">Carregando…</span><div class="sk sk-h1"></div><div class="sk sk-sub"></div>${corpo}</div>`;
}

/* ---------- séries e filmes ---------- */
const ICO_MAIS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ICO_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

export function cardHtml(s, n = 0) {
  const mv = tp(s) === 'movie', p = pct(s), prx = prox(s), est = estado(s);
  const chip = est === 'fim' ? '<span class="sel ok">✓ Concluído</span>' : est === 'assistindo' && !mv ? `<span class="sel">${p}%</span>` : '';
  return `<article class="card" data-id="${s.id}" data-est="${est}" data-i="${Math.min(n, 14)}">
      <div class="poster">
        <button class="capa" data-act="abrir" aria-label="Abrir ${esc(s.nome)}">${capa(s.nome, s.capa)}${chip}${s.nota_pessoal != null ? `<span class="sel dir" title="Minha nota">★ ${s.nota_pessoal}</span>` : ''}<span class="prog"><i data-w="${p}"></i></span></button>
        ${prx ? `<button class="mais" data-act="mais" aria-label="${mv ? 'Marcar ' + esc(s.nome) + ' como visto' : '+1 episódio de ' + esc(s.nome)}" title="${mv ? 'Marcar como visto' : '+1 episódio'}">${mv ? ICO_OK : ICO_MAIS + '<b>1</b>'}</button>` : ''}
      </div>
      <h3>${esc(s.nome)}</h3><small>${rotulo(s)}${mv && s.ano ? ' · ' + esc(s.ano) : ''}</small>
    </article>`;
}

// Cartão largo da fileira "Continuar assistindo"
export function cardContinuar(s, n = 0) {
  const p = pct(s), prx = prox(s);
  return `<article class="card cc" data-id="${s.id}" data-est="${estado(s)}" data-i="${Math.min(n, 14)}">
      <button class="capa" data-act="abrir" aria-label="Abrir ${esc(s.nome)}">${capa(s.nome, s.capa)}</button>
      <div class="cc-info"><h3>${esc(s.nome)}</h3>
        <small>${prx ? `T${prx[0]} · E${prx[1]}` : ''}</small>
        <div class="barra"><i data-w="${p}"></i></div><small class="cc-pct">${vis(s)} de ${tot(s)} · ${p}%</small></div>
      ${prx ? `<button class="mais" data-act="mais" aria-label="+1 episódio de ${esc(s.nome)}" title="+1 episódio">${ICO_MAIS}<b>1</b></button>` : ''}
    </article>`;
}

export const listaDe = tipo => ordenar(filtrar(L.series.filter(s => tp(s) === tipo), { estado: UI.filtro, busca: UI.busca }), UI.ordem);

export function htmlStats(tipo) {
  const mv = tipo === 'movie', Ls = L.series.filter(s => tp(s) === tipo);
  const fim = Ls.filter(s => estado(s) === 'fim').length, eps = Ls.reduce((a, s) => a + vis(s), 0);
  const stats = mv ? [[Ls.length, 'filmes'], [fim, 'assistidos'], [Ls.length - fim, 'na fila']] : [[Ls.length, 'séries'], [eps, 'episódios vistos'], [fim, 'concluídas']];
  return stats.map(([n, r]) => `<div class="stat"><b>${n}</b><span>${r}</span></div>`).join('');
}

export function htmlContinuar(tipo) {
  if (tipo !== 'tv' || UI.busca) return '';
  const c = continuar(L.series);
  return c.length ? `<h2 class="sec-tit">Continuar assistindo</h2><div class="faixa-cards">${c.map((s, n) => cardContinuar(s, n)).join('')}</div>` : '';
}

const VAZIO_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9h18M8 5l-2 4M13 5l-2 4M18 5l-2 4"/></svg>';
export function htmlLista(tipo) {
  const mv = tipo === 'movie', lista = listaDe(tipo), total = L.series.filter(s => tp(s) === tipo).length;
  if (lista.length) return `<div class="grade">${lista.map((s, n) => cardHtml(s, n)).join('')}</div>`;
  if (UI.busca) return `<div class="vazio">${VAZIO_ICO}<p>Nada encontrado para “${esc(UI.busca)}”.</p></div>`;
  if (total) return `<div class="vazio">${VAZIO_ICO}<p>Nada neste filtro.</p></div>`;
  return `<div class="vazio">${VAZIO_ICO}<p><b>${mv ? 'Nenhum filme ainda' : 'Sua estante está vazia'}</b><br>${mv ? 'Registre o primeiro filme que você viu.' : 'Adicione a primeira série para acompanhar cada episódio.'}</p>
    <button class="btn" data-act="nova" data-tipo="${tipo}">${mv ? '+ Adicionar filme' : '+ Adicionar série'}</button></div>`;
}

const LUPA = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
export function viewLista(tipo) {
  const mv = tipo === 'movie';
  const fs = mv ? [['todas', 'Todos'], ['quero', 'Na fila'], ['fim', 'Assistidos']] : [['todas', 'Todas'], ['assistindo', 'Assistindo'], ['quero', 'Na fila'], ['fim', 'Concluídas']];
  if (!fs.some(([k]) => k === UI.filtro)) UI.filtro = 'todas';
  const chips = fs.map(([k, r]) => `<button class="chip" data-act="filtro" data-k="${k}" aria-pressed="${UI.filtro === k}">${r}</button>`).join('');
  return `<div class="cabeca"><div><h1>${mv ? 'Meus filmes' : 'Minhas séries'}</h1>
      <p class="sub">${mv ? 'Registre o que você já viu e o que quer ver.' : 'Acompanhe cada temporada e episódio.'}</p></div>
      <button class="btn nova" data-act="nova" data-tipo="${tipo}"><span aria-hidden="true">+</span><span class="rot">${mv ? 'Novo filme' : 'Nova série'}</span></button></div>
    <div class="stats" id="stats">${htmlStats(tipo)}</div>
    <div id="continuar">${htmlContinuar(tipo)}</div>
    <div class="ferramentas">
      <label class="busca"><span class="sr">Buscar por nome</span>${LUPA}<input type="search" id="busca" placeholder="Buscar por nome" value="${esc(UI.busca)}" autocomplete="off" enterkeyhint="search"></label>
      <label class="ordem"><span class="sr">Ordenar por</span><select id="ordem" aria-label="Ordenar por">${ORDENS.map(([k, r]) => `<option value="${k}" ${UI.ordem === k ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    </div>
    <div class="barra-acoes" role="group" aria-label="Filtrar por estado">${chips}</div>
    <div id="lista">${htmlLista(tipo)}</div>`;
}

/* ---------- detalhe ---------- */
export function htmlOnde(d) {
  if (d === 'carregando') return '<p class="aviso">Procurando onde assistir…</p>';
  if (d === 'erro') return '<p class="aviso">Não foi possível consultar os serviços de streaming agora.</p>';
  if (!d) return '<p class="aviso">Ligue este título ao TMDb (Editar › Buscar no TMDb) para ver onde assistir.</p>';
  const grupo = (rot, a) => a && a.length ? `<div class="prov"><span>${rot}</span>${a.map(p => `<span class="prov-i" title="${esc(p.nome)}">${p.logo ? `<img src="${esc(p.logo)}" alt="" loading="lazy" width="28" height="28">` : ''}${esc(p.nome)}</span>`).join('')}</div>` : '';
  const g = grupo('Assinatura', d.assinatura) + grupo('Grátis', d.gratis) + grupo('Alugar', d.alugar) + grupo('Comprar', d.comprar);
  return g ? `${g}<p class="aviso">Disponibilidade no Brasil. Dados: JustWatch via TMDb.${d.link ? ` <a href="${esc(d.link)}" target="_blank" rel="noopener noreferrer">Ver detalhes</a>` : ''}</p>` : '<p class="aviso">Não consta em nenhum serviço de streaming no Brasil agora.</p>';
}

export function htmlDetalhe(s, onde) {
  const p = pct(s), mv = tp(s) === 'movie';
  const temps = mv ? `<div class="temp"><button class="btn${vis(s) ? ' sec' : ''}" data-act="visto">${vis(s) ? 'Desmarcar como visto' : 'Marcar como visto'}</button></div>` : s.eps.map((n, i) => {
    let c = '';
    for (let e = 1; e <= n; e++) c += `<button class="ep" data-act="ep" data-s="${i}" data-e="${e}" aria-pressed="${s.vis[i] >= e}" aria-label="Episódio ${e}">${e}</button>`;
    return `<div class="temp"><div class="temp-cab"><b>Temporada ${i + 1} <span class="mut-leve">· ${s.vis[i]}/${n}</span></b>
      <button class="btn sec mini" data-act="temp-tudo" data-s="${i}">Marcar toda</button>
      <button class="btn sec mini" data-act="temp-zero" data-s="${i}">Zerar</button></div><div class="eps">${c}</div></div>`;
  }).join('');
  const urlHero = s.capa && /^https:\/\/[\w./:+=%?&,~@-]+$/.test(s.capa);
  const pilulas = [mv ? 'Filme' : 'Série', s.ano, s.nota ? '★ ' + s.nota : '', s.duracao ? s.duracao + (mv ? ' min' : ' min/ep') : ''].filter(Boolean).map(x => `<span class="pilula">${esc(x)}</span>`).join('');
  return `<div data-id="${s.id}">
    <div class="hero" ${urlHero ? `data-cover="${esc(s.capa)}"` : `data-h="${hue(s.nome)}"`}></div>
    <div class="cab"><div class="mini-capa">${capa(s.nome, s.capa, true)}</div>
      <div class="cab-info"><h2>${esc(s.nome)}</h2><div class="pilulas">${pilulas}</div><div class="barra"><i data-w="${p}"></i></div>
      <small>${mv ? rotulo(s) : vis(s) + ' de ' + tot(s) + ' episódios · ' + rotulo(s)}</small></div></div>
    ${s.sinopse ? `<p class="sin">${esc(s.sinopse)}</p>` : ''}
    ${temps}
    <section class="bloco"><h3>Onde assistir</h3><div id="onde">${htmlOnde(onde)}</div></section>
    <section class="bloco"><h3>Minha avaliação</h3>
      <label>Minha nota (0 a 10)<input type="number" id="mnota" min="0" max="10" step="0.5" inputmode="decimal" value="${s.nota_pessoal == null ? '' : s.nota_pessoal}" placeholder="Sem nota"></label>
      <label>Resenha<textarea id="mres" maxlength="4000" rows="3" placeholder="O que você achou?">${esc(s.resenha || '')}</textarea></label>
    </section>
    <div class="rodape-dlg">
      <button class="btn sec perigo mini" data-act="del">Excluir ${mv ? 'filme' : 'série'}</button>
      ${s.tmdb ? `<button class="btn sec" data-act="atualizar-tmdb">Atualizar do TMDb</button>` : ''}
      <button class="btn sec" data-act="editar">Editar</button>
      <button class="btn" data-act="fechar">Fechar</button></div></div>`;
}

/* ---------- tops ---------- */
export function viewTops() {
  const dl = `<datalist id="nomes">${L.series.map(s => `<option value="${esc(s.nome)}"></option>`).join('')}</datalist>`;
  const cards = L.tops.map((t, n) => {
    const li = t.itens.map((it, i) => {
      const s = it.sid ? achar(it.sid) : null;
      return `<li data-i="${i}"><button class="alca" data-alca aria-label="Reordenar ${esc(it.t)}. Arraste, ou use as setas do teclado" title="Arraste para reordenar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>
        <span class="n">${i + 1}</span><div class="p">${capa(it.t, s && s.capa)}</div><span class="t">${esc(it.t)}</span>
        <span class="mv"><button data-act="tira" aria-label="Remover ${esc(it.t)}">✕</button></span></li>`;
    }).join('');
    return `<section class="top" data-top="${t.id}" data-i="${Math.min(n, 8)}">
      <div class="top-cab"><h2>${esc(t.nome)}</h2><small>${t.itens.length}/10</small><button class="btn sec perigo mini" data-act="del-top">Excluir</button></div>
      ${li ? `<ol>${li}</ol>` : '<p class="mut-peq">Lista vazia. Adicione seu primeiro título.</p>'}
      ${t.itens.length < 10 ? `<div class="add"><input type="text" list="nomes" maxlength="80" placeholder="Série ou filme" aria-label="Adicionar título"><button class="btn mini" data-act="add-item">Adicionar</button></div>` : ''}
    </section>`;
  }).join('');
  return `<div class="cabeca"><div><h1>Meus tops 10</h1>
    <p class="sub">Monte rankings do seu jeito. Arraste a alça ⋮⋮ para mudar a posição.</p></div></div>
    <div class="nova-top"><input type="text" id="nt" maxlength="60" placeholder="Nome do top (ex.: Melhores séries de 2026)" aria-label="Nome do novo top"><button class="btn" data-act="novo-top">Criar</button></div>
    ${L.tops.length ? `<div class="tops">${cards}</div>` : '<div class="vazio">Nenhum top criado ainda.</div>'}${dl}`;
}

/* ---------- estatísticas ---------- */
export function graficoMeses(meses) {
  const max = Math.max(1, ...meses.map(m => m.valor)), W = 720, H = 220, pad = 28, bw = (W - pad * 2) / meses.length;
  const barras = meses.map((m, i) => {
    const h = Math.round((H - 56) * m.valor / max), x = pad + i * bw + bw * .16, w = bw * .68, y = H - 30 - h;
    return `<g><rect x="${x}" y="${y}" width="${w}" height="${Math.max(h, m.valor ? 3 : 1)}" rx="4" class="${m.valor ? '' : 'vz'}"><title>${m.rotulo}/${m.ano}: ${m.valor}</title></rect>
      ${m.valor ? `<text x="${x + w / 2}" y="${y - 6}" text-anchor="middle" class="v">${m.valor}</text>` : ''}
      <text x="${x + w / 2}" y="${H - 10}" text-anchor="middle">${m.rotulo}</text></g>`;
  }).join('');
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Episódios e filmes marcados como vistos, por mês, nos últimos 12 meses"><line x1="${pad}" x2="${W - pad}" y1="${H - 30}" y2="${H - 30}"/>${barras}</svg>`;
}

export function viewStats() {
  const r = estatisticas(L.series), meses = ultimosMeses(r.porMes, 12), totalAno = meses.reduce((a, m) => a + m.valor, 0);
  const cards = [
    [r.minutos ? duracaoTexto(r.minutos) : '—', 'tempo assistido'], [r.episodios, 'episódios vistos'], [r.filmes, 'filmes assistidos'],
    [r.concluidas, 'séries concluídas'], [r.notaMedia == null ? '—' : r.notaMedia, `nota média (${r.nNotas} ${r.nNotas === 1 ? 'título' : 'títulos'})`],
  ];
  const faltam = L.series.filter(s => s.tmdb && !s.duracao && vis(s) > 0).length;
  return `<div class="cabeca"><div><h1>Estatísticas</h1><p class="sub">Seu histórico de séries e filmes.</p></div></div>
    <div class="stats grande">${cards.map(([n, t]) => `<div class="stat"><b>${n}</b><span>${t}</span></div>`).join('')}</div>
    ${r.semDuracao ? `<p class="aviso">${r.semDuracao} ${r.semDuracao === 1 ? 'título' : 'títulos'} sem duração informada não entram na conta de tempo. ${faltam ? `<button class="btn sec mini" data-act="completar-duracoes">Completar pelo TMDb</button>` : 'Edite o título ou ligue-o ao TMDb para completar.'}</p>` : ''}
    <h2 class="sec-tit">Por mês <small class="mut-leve">· ${totalAno} nos últimos 12 meses</small></h2>
    <div class="graf-caixa">${graficoMeses(meses)}</div>
    <p class="aviso">O gráfico conta episódios e filmes marcados a partir desta versão do app; o que você já tinha marcado antes não tem data.</p>`;
}

/* ---------- entrar / criar conta ---------- */
export function viewAuth(modo = 'entrar') {
  const nova = modo === 'criar';
  return `<div class="auth"><div class="auth-logo" aria-hidden="true"><i></i></div><h1>${nova ? 'Criar conta' : 'Entrar'}</h1>
    <p class="sub">${nova ? 'Cada pessoa tem a própria estante de séries e filmes.' : 'Entre para acessar sua estante.'}</p>
    <div class="abas" role="group" aria-label="Entrar ou criar conta">
      <button class="chip" data-act="auth-modo" data-m="entrar" aria-pressed="${!nova}" type="button">Entrar</button>
      <button class="chip" data-act="auth-modo" data-m="criar" aria-pressed="${nova}" type="button">Criar conta</button></div>
    <form id="fa" data-modo="${modo}" novalidate>
      ${nova ? '<label>Nome<input type="text" name="nome" maxlength="60" autocomplete="name" required></label>' : ''}
      <label>E-mail<input type="text" name="email" inputmode="email" autocapitalize="off" spellcheck="false" autocomplete="${nova ? 'email' : 'username'}" required></label>
      <label>Senha${nova ? ' (mínimo 8 caracteres)' : ''}<input type="password" name="senha" autocomplete="${nova ? 'new-password' : 'current-password'}" required></label>
      <p class="aviso" id="msg" role="alert"></p>
      <button class="btn" type="submit">${nova ? 'Criar conta e entrar' : 'Entrar'}</button>
    </form></div>`;
}
