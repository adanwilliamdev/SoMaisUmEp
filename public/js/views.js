// Funções que montam o HTML das telas (sem eventos). Os eventos ficam em main.js.
import { esc, hue, ler } from './util.js';
import { L, achar } from './loja.js';
import { tp, tot, vis, estado, prox, pct, rotulo, filtrar, ordenar, continuar, ORDENS, estatisticas, ultimosMeses, duracaoTexto, lancamento, proximosLancamentos, naEstante, sementes } from './regras.js';

export const UI = { filtro: 'todas', busca: '', ordem: ler('claq:ordem', 'recente'), descTipo: 'tv' };

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

// Selo "Novo ep sexta" / "Estreia em 12 nov" (some sozinho quando a data passa).
const chipLanc = s => { const l = lancamento(s); return l ? `<span class="lanc${l.dias <= 1 ? ' perto' : ''}">${esc(l.texto)}</span>` : ''; };

export function cardHtml(s, n = 0) {
  const mv = tp(s) === 'movie', p = pct(s), prx = prox(s), est = estado(s);
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
  const p = pct(s), prx = prox(s);
  const botao = (cls, miolo) => prx ? `<button class="mais ${cls}" data-act="mais" aria-label="+1 episódio de ${esc(s.nome)}" title="+1 episódio">${miolo}</button>` : '';
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

export const listaDe = tipo => ordenar(filtrar(L.series.filter(s => tp(s) === tipo), { estado: UI.filtro, busca: UI.busca }), UI.ordem);

export function htmlStats(tipo) {
  const mv = tipo === 'movie', Ls = L.series.filter(s => tp(s) === tipo);
  const fim = Ls.filter(s => estado(s) === 'fim').length, eps = Ls.reduce((a, s) => a + vis(s), 0);
  const stats = mv ? [[Ls.length, 'filmes'], [fim, 'assistidos'], [Ls.length - fim, 'na fila']] : [[Ls.length, 'séries'], [eps, 'episódios vistos'], [fim, 'concluídas']];
  return stats.map(([n, r]) => `<div class="stat"><b>${n}</b><span>${r}</span></div>`).join('');
}

// "Próximos lançamentos": o que sai nas próximas semanas entre os títulos da estante (série ou filme, conforme a aba).
export function htmlProximos(tipo) {
  if (UI.busca) return '';
  const lista = proximosLancamentos(L.series, { tipo });
  if (!lista.length) return '';
  const mv = tipo === 'movie';
  return `<section class="prox" aria-labelledby="t-prox"><h2 class="sec-tit" id="t-prox">${mv ? 'Próximas estreias' : 'Próximos episódios'}</h2>
    <ul class="prox-lista">${lista.map(({ s, l }) => `<li class="prox-i${l.hoje ? ' hoje' : ''}" data-id="${esc(s.id)}">
      <button class="prox-b" data-act="abrir" aria-label="Abrir ${esc(s.nome)}"><span class="prox-data" aria-hidden="true"><b>${l.dia}</b>${esc(l.mes)}</span>
      <span class="prox-txt"><b>${esc(s.nome)}</b><small>${l.t && l.e ? `T${l.t} · E${l.e} · ` : ''}${esc(l.quando)}</small></span></button></li>`).join('')}</ul></section>`;
}

export function htmlContinuar(tipo) {
  if (tipo !== 'tv' || UI.busca) return '';
  const c = continuar(L.series);
  if (!c.length) return '';
  const [destaque, ...resto] = c;
  return `<section class="fila" aria-labelledby="t-fila"><h2 class="sec-tit" id="t-fila">Continuar assistindo</h2>
    <div class="fila-grade${resto.length ? '' : ' so-um'}">${cardContinuar(destaque, 0)}${resto.length ? `<div class="fila-resto">${resto.map((s, n) => cardContinuar(s, n + 1)).join('')}</div>` : ''}</div></section>`;
}

const VAZIO_ICO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9h18M8 5l-2 4M13 5l-2 4M18 5l-2 4"/></svg>';
export function htmlLista(tipo) {
  const mv = tipo === 'movie', lista = listaDe(tipo), total = L.series.filter(s => tp(s) === tipo).length;
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
  const fs = mv ? [['todas', 'Todos'], ['quero', 'Na fila'], ['fim', 'Assistidos']] : [['todas', 'Todas'], ['assistindo', 'Assistindo'], ['quero', 'Na fila'], ['fim', 'Concluídas']];
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
  const l = lancamento(s), pilulas = [mv ? 'Filme' : 'Série', s.ano, s.nota ? '★ ' + s.nota : '', s.duracao ? s.duracao + (mv ? ' min' : ' min/ep') : '', l ? `${l.texto}${l.t && l.e ? ` · T${l.t} E${l.e}` : ''}` : ''].filter(Boolean).map(x => `<span class="pilula">${esc(x)}</span>`).join('');
  return `<div data-id="${esc(s.id)}">
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
    return `<section class="top" data-top="${esc(t.id)}" data-i="${Math.min(n, 8)}">
      <div class="top-cab"><h2>${esc(t.nome)}</h2><small>${t.itens.length}/10</small>${t.itens.length ? `<button class="btn sec mini" data-act="compartilhar">${L.links[t.id] ? 'Compartilhado' : 'Compartilhar'}</button>` : ''}<button class="btn sec perigo mini" data-act="del-top">Excluir</button></div>
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
// Duas colunas: a marca em letras grandes e o formulário.
const casca = corpo => `<div class="auth"><div class="auth-marca"><span class="auth-logo" aria-hidden="true"></span>
    <p class="auth-nome"><span class="sr">SóMaisUmEp</span><span aria-hidden="true">Só<br>Mais<br>Um<br>Ep</span></p>
    <p class="auth-frase">Marque cada episódio e saiba sempre qual é o próximo.</p></div>
    <div class="auth-form">${corpo}</div></div>`;

export function viewAuth(modo = 'entrar') {
  const nova = modo === 'criar';
  return casca(`<h1>${nova ? 'Criar conta' : 'Entrar'}</h1>
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
    </form>
    ${nova ? '' : '<p class="auth-rodape"><button type="button" class="link" data-act="auth-modo" data-m="esqueci">Esqueci minha senha</button></p>'}`);
}

export const viewEsqueci = () => casca(`<h1>Recuperar senha</h1>
    <p class="sub">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
    <form id="fe" novalidate>
      <label>E-mail<input type="text" name="email" inputmode="email" autocapitalize="off" spellcheck="false" autocomplete="username" required></label>
      <p class="aviso" id="msg" role="alert"></p>
      <button class="btn" type="submit">Enviar link</button>
    </form>
    <p class="auth-rodape"><button type="button" class="link" data-act="auth-modo" data-m="entrar">Voltar para entrar</button></p>`);

export const viewRedefinir = () => casca(`<h1>Nova senha</h1>
    <p class="sub">Escolha uma nova senha para a sua conta. Você será desconectado dos outros aparelhos.</p>
    <form id="fr" novalidate>
      <label>Nova senha (mínimo 8 caracteres)<input type="password" name="senha" autocomplete="new-password" required></label>
      <label>Repita a nova senha<input type="password" name="senha2" autocomplete="new-password" required></label>
      <p class="aviso" id="msg" role="alert"></p>
      <button class="btn" type="submit">Salvar nova senha</button>
    </form>`);

// Formulários da conta (dentro do diálogo "Minha conta"): trocar senha, trocar e-mail, excluir conta.
export function viewFormConta(acao, email = '') {
  const senhaAtual = '<label>Senha atual<input type="password" name="atual" autocomplete="current-password" required></label>';
  const campos = acao === 'senha'
    ? `${senhaAtual}<label>Nova senha (mínimo 8 caracteres)<input type="password" name="nova" autocomplete="new-password" required></label>
       <label>Repita a nova senha<input type="password" name="nova2" autocomplete="new-password" required></label>
       <p class="aviso">Os outros aparelhos serão desconectados.</p>`
    : acao === 'email'
      ? `<label>Novo e-mail<input type="text" name="email" inputmode="email" autocapitalize="off" spellcheck="false" autocomplete="email" value="${esc(email)}" required></label>${senhaAtual}`
      : `<p class="aviso">Isto apaga a sua conta, todas as séries, filmes, tops e capas. <b>Não dá para desfazer.</b> Baixe um backup antes, se quiser guardar seus dados.</p>${senhaAtual}`;
  const titulo = { senha: 'Trocar senha', email: 'Trocar e-mail', excluir: 'Excluir conta' }[acao];
  return `<h2>${titulo}</h2><form id="fc" data-acao="${acao}" novalidate>${campos}
    <p class="aviso" id="msgc" role="alert"></p>
    <div class="rodape-dlg"><button type="button" class="btn sec" data-act="conta">Voltar</button><button class="btn${acao === 'excluir' ? ' perigo' : ''}" type="submit">${acao === 'excluir' ? 'Excluir minha conta' : 'Salvar'}</button></div></form>`;
}

/* ---------- descobrir ---------- */
// `d` = { alta, parecidos } (cada um: lista, 'carregando', 'erro' ou null quando não se aplica).
function cardDescobrir(x, tipo, porque = '') {
  const tem = naEstante(L.series, tipo, x.id);
  return `<article class="card desc" data-tid="${esc(x.id)}">
    <div class="poster"><button class="capa" data-act="desc-abrir" aria-label="Ver ${esc(x.nome)}">${capa(x.nome, x.poster)}${tem ? '<span class="sel ok">Na estante</span>' : ''}${x.nota ? `<span class="sel dir" title="Nota no TMDb">★ ${x.nota}</span>` : ''}</button>
      ${tem ? '' : `<button class="mais mais-add" data-act="desc-add" aria-label="Adicionar ${esc(x.nome)} à estante" title="Adicionar à estante">${ICO_MAIS}</button>`}</div>
    <h3>${esc(x.nome)}</h3><small>${esc(x.ano || '')}${porque ? (x.ano ? ' · ' : '') + esc(porque) : ''}</small></article>`;
}
function blocoDescobrir(titulo, id, d, tipo, porque) {
  const corpo = d === 'carregando' ? `<div class="grade">${Array.from({ length: 6 }, () => '<div><div class="sk sk-capa"></div><div class="sk sk-l1"></div></div>').join('')}</div>`
    : d === 'erro' ? '<p class="aviso">Não foi possível buscar no TMDb agora. <button class="btn sec mini" data-act="desc-recarregar">Tentar de novo</button></p>'
    : !d.length ? '<p class="aviso">Nada novo por aqui: tudo o que o TMDb indicou já está na sua estante.</p>'
    : `<div class="grade">${d.map((x, i) => cardDescobrir(x, tipo, porque ? porque(x) : '')).join('')}</div>`;
  return `<section class="desc-sec" aria-labelledby="${id}"><h2 class="sec-tit" id="${id}">${titulo}</h2>${corpo}</section>`;
}
export function htmlDescobrir(tipo, d) {
  const nomeDe = id => (L.series.find(s => tp(s) === tipo && s.tmdb === id) || {}).nome;
  const semente = sementes(L.series, tipo).length;
  const par = d.parecidos === null ? '' : blocoDescobrir('Parecidos com o que você viu', 't-par',
    Array.isArray(d.parecidos) ? d.parecidos.filter(x => !naEstante(L.series, tipo, x.id)) : d.parecidos, tipo,
    x => { const n = (x.porque || []).map(nomeDe).find(Boolean); return n ? 'como ' + n : ''; });
  const alta = blocoDescobrir('Em alta esta semana', 't-alta', d.alta, tipo, null);
  const dica = !semente ? `<p class="aviso">Marque alguns episódios ou filmes ligados ao TMDb e aparece aqui uma lista “parecidos com o que você viu”.</p>` : '';
  return par + (par ? '' : dica) + alta;
}
export function viewDescobrir(d) {
  const tipo = UI.descTipo, fs = [['tv', 'Séries'], ['movie', 'Filmes']];
  return `<div class="cabeca"><div><h1>Descobrir</h1><p class="sub">O que está em alta e o que combina com o seu gosto. Toque no + para adicionar à estante.</p></div></div>
    <div class="ferramentas"><div class="barra-acoes" role="group" aria-label="Tipo">${fs.map(([k, r]) => `<button class="chip" data-act="desc-tipo" data-k="${k}" aria-pressed="${tipo === k}">${r}</button>`).join('')}</div></div>
    <div id="desc">${htmlDescobrir(tipo, d)}</div>`;
}
export function htmlDescDetalhe(x, tipo, onde) {
  const tem = naEstante(L.series, tipo, x.id);
  const pilulas = [tipo === 'movie' ? 'Filme' : 'Série', x.ano, x.nota ? '★ ' + x.nota : ''].filter(Boolean).map(p => `<span class="pilula">${esc(p)}</span>`).join('');
  return `<div data-tid="${esc(x.id)}"><div class="cab"><div class="mini-capa">${capa(x.nome, x.poster, true)}</div>
    <div class="cab-info"><h2>${esc(x.nome)}</h2><div class="pilulas">${pilulas}</div></div></div>
    ${x.sinopse ? `<p class="sin">${esc(x.sinopse)}${x.sinopse.length >= 300 ? '…' : ''}</p>` : ''}
    <section class="bloco"><h3>Onde assistir</h3><div id="onde">${htmlOnde(onde)}</div></section>
    <div class="rodape-dlg"><button class="btn sec" data-act="fechar">Fechar</button>${tem ? '<span class="sel ok est">Na sua estante</span>' : '<button class="btn" data-act="desc-add">+ Adicionar à estante</button>'}</div></div>`;
}

/* ---------- compartilhar top ---------- */
export function htmlCompartilhar(t, codigo, url = '') {
  return `<div data-top="${esc(t.id)}"><h2>Compartilhar “${esc(t.nome)}”</h2>
    <section class="bloco"><h3>Imagem</h3><p class="sub topo6">Pronta para postar em stories e no feed.</p>
      <div class="share-prev" id="share-prev" aria-busy="true"><span class="aviso">Montando a imagem…</span></div>
      <div class="rodape-dlg esq"><button class="btn" data-act="img-enviar" disabled>Compartilhar imagem</button></div></section>
    <section class="bloco"><h3>Link público</h3>
      ${codigo ? `<p class="sub topo6">Qualquer pessoa com o link vê o nome do top, os títulos e o seu primeiro nome. Você pode desligar quando quiser.</p>
        <div class="linha-busca"><input type="text" id="share-url" readonly aria-label="Link público" value="${esc(url)}"><button class="btn mini" data-act="link-copiar">Copiar</button></div>
        <div class="rodape-dlg esq"><button class="btn sec perigo" data-act="link-desligar">Parar de compartilhar</button></div>`
      : `<p class="sub topo6">Crie um link para mostrar este top a quem não tem o app. Qualquer pessoa com o link vê o nome do top, os títulos e o seu primeiro nome.</p>
        <div class="rodape-dlg esq"><button class="btn sec" data-act="link-criar">Criar link público</button></div>`}
      <p class="aviso" id="share-msg" role="status"></p></section>
    <div class="rodape-dlg"><button class="btn" data-act="fechar">Fechar</button></div></div>`;
}

/* ---------- importar ---------- */
export function htmlImportar(fase = {}) {
  if (fase.previa) {
    const r = fase.previa, linha = (n, t) => n ? `<li><b>${n}</b> ${t}</li>` : '';
    return `<h2>Importar</h2><p class="sub topo6">Encontrei em ${esc(fase.fontes.join(', '))}:</p>
      <ul class="imp-lista">${linha(r.filmesVistos, r.filmesVistos === 1 ? 'filme assistido' : 'filmes assistidos')}${linha(r.filmesFila, r.filmesFila === 1 ? 'filme na lista para ver' : 'filmes na lista para ver')}${linha(r.series, r.series === 1 ? 'série' : 'séries')}${linha(r.episodios, r.episodios === 1 ? 'episódio visto' : 'episódios vistos')}</ul>
      ${r.seriesSemProgresso ? `<p class="aviso">${r.seriesSemProgresso} ${r.seriesSemProgresso === 1 ? 'série vem' : 'séries vêm'} sem progresso: esse arquivo não informa os episódios vistos. Você marca o que já viu depois.</p>` : ''}
      <p class="aviso">Títulos que já estão na sua estante não são duplicados. As capas, durações e temporadas vêm do TMDb, então pode levar um tempinho.</p>
      <div class="rodape-dlg"><button class="btn sec" data-act="fechar">Cancelar</button><button class="btn" data-act="importar-iniciar">Importar tudo</button></div>`;
  }
  if (fase.andamento) return `<h2>Importando…</h2><div class="barra imp-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${fase.andamento.pct}"><i data-w="${fase.andamento.pct}"></i></div>
      <p class="sub topo6" id="imp-txt" role="status">${esc(fase.andamento.texto)}</p><div class="rodape-dlg"><button class="btn sec" data-act="importar-parar">Parar</button></div>`;
  if (fase.fim) {
    const f = fase.fim;
    return `<h2>${f.parou ? 'Importação interrompida' : 'Importação concluída'}</h2>
      <ul class="imp-lista">${f.novos ? `<li><b>${f.novos}</b> ${f.novos === 1 ? 'título adicionado' : 'títulos adicionados'}</li>` : '<li>Nenhum título novo.</li>'}${f.repetidos ? `<li><b>${f.repetidos}</b> já estavam na estante</li>` : ''}${f.naoAchou.length ? `<li><b>${f.naoAchou.length}</b> não encontrados no TMDb</li>` : ''}</ul>
      ${f.naoAchou.length ? `<details class="colar"><summary>Ver os não encontrados</summary><p class="mut-peq">${f.naoAchou.slice(0, 40).map(esc).join('<br>')}${f.naoAchou.length > 40 ? `<br>… e mais ${f.naoAchou.length - 40}` : ''}</p></details>` : ''}
      <div class="rodape-dlg"><button class="btn" data-act="fechar">Fechar</button></div>`;
  }
  return `<h2>Importar de outro app</h2><p class="sub topo6">Traga sua lista de quem você já usa. Escolha o arquivo exportado (pode escolher vários de uma vez):</p>
    <ul class="imp-passos">
      <li><b>Letterboxd</b> (filmes): Settings › Data › Export your data. Envie o .zip inteiro, ou os CSV (watched, ratings, watchlist).</li>
      <li><b>IMDb</b>: na sua lista de avaliações ou na watchlist, menu ⋯ › Export. Envie o .csv.</li>
      <li><b>Trakt</b>: envie os arquivos .json do export (assistidos, avaliações, watchlist).</li>
    </ul>
    <p class="aviso" id="imp-msg" role="alert"></p>
    <div class="rodape-dlg esq"><label class="btn arq">Escolher arquivos…<input type="file" id="imparq" accept=".zip,.csv,.json,application/zip,application/json,text/csv" multiple hidden></label></div>
    <div class="rodape-dlg"><button class="btn sec" data-act="fechar">Cancelar</button></div>`;
}
