import { $, esc, uid, status, aviso, guardar, ler } from './util.js';
import { api, tmdb } from './api.js';
import { L, achar, save, carregar, ligar, ligarRede, recarregarSuave, limparSnap, zerar, pendente } from './loja.js';
import { tp, vis, estado, prox, registrarProgresso, acharDuplicado, semDuplicados } from './regras.js';
import * as V from './views.js';
import { enviarCapa, migrarCapas } from './capas.js';
import { atualizarDoTmdb, atualizarAutomatico, completarDuracoes, ondeAssistir } from './tmdbsync.js';

const app = $('#app'), dlg = $('#dlg');
let logado = false, aberta = null, novaCapa, animar = true;
const onde = {}; // id -> 'carregando' | 'erro' | dados | null (cache da tela "Onde assistir")

/* ---------- abas e renderização ---------- */
const aba = () => (['#tops', '#filmes', '#stats'].includes(location.hash) ? location.hash : '#series');
const tipoAtual = () => (aba() === '#filmes' ? 'movie' : 'tv');
const naLista = () => aba() === '#series' || aba() === '#filmes';

function render() {
  if (!logado) return;
  const a = aba(), y = scrollY, manter = !animar;
  document.querySelectorAll('.menu a').forEach(l => { if (l.getAttribute('href') === a) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
  app.classList.toggle('entra', animar); animar = false; // anima só ao trocar de aba, não a cada +1 episódio
  app.innerHTML = a === '#tops' ? V.viewTops() : a === '#stats' ? V.viewStats() : V.viewLista(tipoAtual());
  revela();
  if (manter) scrollTo({ top: y, behavior: 'instant' });
}

// Atualiza só a lista (busca, filtro, ordem) sem mexer no campo de busca nem na rolagem.
function renderLista(anim = false) {
  if (!naLista() || !$('#lista')) return render();
  const t = tipoAtual();
  app.classList.toggle('entra', anim);
  $('#stats').innerHTML = V.htmlStats(t); $('#continuar').innerHTML = V.htmlContinuar(t); $('#lista').innerHTML = V.htmlLista(t);
  document.querySelectorAll('[data-act="filtro"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === V.UI.filtro));
  revela();
}

// Troca só o(s) card(s) do título alterado (e os números do topo). Se o estado mudou, o filtro pode mudar: refaz a lista.
function patchCard(id, mudouEstado) {
  if (!naLista() || !$('#stats')) return;
  if (mudouEstado) return renderLista();
  const s = achar(id); if (!s) return;
  $('#stats').innerHTML = V.htmlStats(tipoAtual());
  document.querySelectorAll(`.card[data-id="${id}"]`).forEach(el => {
    const t = document.createElement('template'); t.innerHTML = (el.classList.contains('cc') ? V.cardContinuar : V.cardHtml)(s, +el.style.getPropertyValue('--i') || 0);
    el.replaceWith(t.content.firstElementChild);
  });
  revela();
}
const refresca = () => { if (naLista()) renderLista(); else if (aba() === '#stats') render(); };

// Marca progresso: registra histórico, salva e atualiza só o que mudou na tela.
function mexer(s, fn) {
  const antes = vis(s), est = estado(s);
  fn(); registrarProgresso(s, antes); save();
  patchCard(s.id, est !== estado(s));
  if (aberta === s.id) pintaDetalhe();
}

addEventListener('hashchange', () => { animar = true; V.UI.busca = ''; scrollTo({ top: 0, behavior: 'instant' }); render(); });

// Imagens entram com fade quando terminam de carregar (load/error não borbulham: captura).
const mostra = e => { if (e.target.tagName === 'IMG') e.target.classList.add('ok'); };
document.addEventListener('load', mostra, true);
document.addEventListener('error', mostra, true);
function revela() { document.querySelectorAll('img.fade:not(.ok)').forEach(i => { if (i.complete && i.naturalWidth) i.classList.add('ok'); }); }

/* ---------- entrar / criar conta ---------- */
function telaAuth(modo = 'entrar') {
  logado = false; document.body.classList.add('deslogado'); if (dlg.open) dlg.close();
  app.classList.remove('entra'); app.innerHTML = V.viewAuth(modo);
  const f = $('#fa'); (modo === 'criar' ? f.nome : f.email).focus();
}
async function enviarAuth(f) {
  const m = $('#msg'), criar = f.dataset.modo === 'criar', btn = f.querySelector('[type=submit]');
  m.textContent = ''; btn.disabled = true;
  try {
    await api(criar ? '/api/cadastro' : '/api/login', { method: 'POST', body: { nome: f.nome && f.nome.value, email: f.email.value, senha: f.senha.value } });
    iniciar();
  } catch (e) { m.textContent = e.message; btn.disabled = false; }
}
ligar({
  render: () => { render(); if (aberta && dlg.open && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) pintaDetalhe(); },
  login: () => telaAuth('entrar'),
});

async function sair(todos = false) {
  if (pendente() && !confirm('Há alterações que ainda não foram enviadas. Sair mesmo assim?')) return;
  try { await api('/api/logout', { method: 'POST', body: { todos } }); }
  catch (e) { if (todos) { aviso('Sem conexão: não foi possível encerrar as sessões agora.'); return; } }
  limparSnap(); zerar(); for (const k in onde) delete onde[k]; telaAuth('entrar');
}

/* ---------- início ---------- */
async function iniciar() {
  app.classList.remove('entra'); app.innerHTML = V.esqueleto(location.hash);
  try {
    const r = await carregar();
    logado = true; document.body.classList.remove('deslogado');
    $('#conta').textContent = (L.usuario.nome.trim()[0] || '?').toUpperCase();
    animar = true; status(r.offline ? 'Sem conexão' : 'Salvo ✓'); render();
    if (!r.offline) depois();
  } catch (e) {
    if (e.auth) telaAuth('entrar');
    else app.innerHTML = `<div class="vazio">Não foi possível carregar seus dados: ${esc(e.message)}<br><small>Se persistir, confira as variáveis de ambiente e o banco (veja o README, "Se aparecer erro no servidor").</small><br><br><button class="btn mini" data-act="recarregar">Tentar de novo</button></div>`;
  }
}
// Tarefas em segundo plano depois de abrir: capas para o Blob e temporadas novas.
async function depois() {
  try { await migrarCapas(); } catch (e) { /* tenta de novo na próxima abertura */ }
  await atualizarAutomatico({ aoMudar: (s, r) => {
    aviso(r.voltouAssistir ? `Novos episódios de ${s.nome}!` : `${s.nome} atualizado (${r.mudou.join(', ')}).`);
    refresca();
  } });
}

/* ---------- detalhe do título ---------- */
function pintaDetalhe() {
  const s = achar(aberta); if (!s) { dlg.close(); return; }
  const y = dlg.scrollTop;
  dlg.innerHTML = V.htmlDetalhe(s, onde[s.id] === undefined ? (s.tmdb ? 'carregando' : null) : onde[s.id]);
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = y; revela();
  carregaOnde(s);
}
function pintaOnde(s) { const el = $('#onde'); if (el && aberta === s.id) el.innerHTML = V.htmlOnde(onde[s.id]); }
async function carregaOnde(s) {
  if (onde[s.id] !== undefined) return;
  if (!s.tmdb) { onde[s.id] = null; return; }
  onde[s.id] = 'carregando';
  try { onde[s.id] = await ondeAssistir(s); } catch (e) { onde[s.id] = 'erro'; }
  pintaOnde(s);
}
function salvaAvaliacao() {
  const s = achar(aberta), n = $('#mnota'), r = $('#mres'); if (!s || !n || !r) return;
  const v = n.value.trim().replace(',', '.'), nota = v === '' || !Number.isFinite(+v) ? null : Math.max(0, Math.min(10, Math.round(+v * 2) / 2));
  const res = r.value.trim() || null;
  if (nota === (s.nota_pessoal ?? null) && res === (s.resenha ?? null)) return;
  s.nota_pessoal = nota; s.resenha = res; n.value = nota == null ? '' : nota;
  save(); patchCard(s.id, false);
}
dlg.addEventListener('change', e => { if (e.target.id === 'mnota' || e.target.id === 'mres') salvaAvaliacao(); });
dlg.addEventListener('close', () => { salvaAvaliacao(); aberta = null; for (const k in onde) if (onde[k] === 'erro') delete onde[k]; });

/* ---------- formulário de série/filme ---------- */
function formSerie(id, tipoNovo) {
  const s = id ? achar(id) : null;
  const tipo = s ? tp(s) : (tipoNovo || 'tv'), mv = tipo === 'movie';
  novaCapa = s ? s.capa : null;
  let meta = s ? { sinopse: s.sinopse, ano: s.ano, duracao: s.duracao, nota: s.nota, tmdb: s.tmdb } : {};
  aberta = null;
  dlg.innerHTML = `<h2>${s ? 'Editar' : mv ? 'Novo' : 'Nova'} ${mv ? 'filme' : 'série'}</h2><br>
    <form id="f" data-id="${s ? s.id : ''}">
      <label>Nome<input type="text" name="nome" required maxlength="80" value="${s ? esc(s.nome) : ''}"></label>
      <label>Buscar no TMDb (opcional)<span style="display:flex;gap:8px"><input type="text" id="tq" placeholder="${mv ? 'Nome do filme' : 'Nome da série'}"><button type="button" class="btn mini" id="tb">Buscar</button></span></label>
      <div id="res" class="res"></div>
      <div id="dup"></div>
      <div id="blocotemp" ${mv ? 'hidden' : ''}><label>Número de temporadas<input type="number" name="nt" min="1" max="30" value="${s ? s.eps.length : 1}"></label>
      <div style="font-size:.82rem;font-weight:600;color:var(--mut);margin-bottom:6px">Episódios por temporada</div>
      <div class="eps-inputs" id="temps"></div><br></div>
      <label>Capa (opcional)<input type="file" accept="image/*" name="capa"></label>
      <div id="previa"></div>
      <div class="rodape-dlg"><button type="button" class="btn sec" data-act="${s ? 'abrir' : 'fechar'}">Cancelar</button><button class="btn" type="submit">Salvar</button></div>
    </form>`;
  const f = $('#f');
  let salvando = false;
  // Avisa (sem bloquear a tela) quando o título já está na estante; o botão leva até ele.
  const avisoDup = cand => {
    const d = acharDuplicado(L.series, cand, s && s.id);
    $('#dup').innerHTML = d ? `<p class="aviso">⚠️ <b>${esc(d.nome)}</b>${d.ano ? ' (' + esc(d.ano) + ')' : ''} já está na sua estante. <button type="button" class="btn mini sec" data-act="abrir" data-id="${esc(d.id)}">Abrir o existente</button></p>` : '';
    return d;
  };
  const desenha = arr => {
    const n = Math.max(1, Math.min(30, +f.nt.value || 1));
    const atual = [...document.querySelectorAll('#temps input')].map(i => +i.value);
    $('#temps').innerHTML = Array.from({ length: n }, (_, i) =>
      `<label>T${i + 1}<input type="number" min="1" max="999" value="${(arr && arr[i]) || atual[i] || (s && s.eps[i]) || 10}"></label>`).join('');
  };
  const previa = () => { $('#previa').innerHTML = novaCapa ? `<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px"><div style="width:56px;aspect-ratio:2/3;border-radius:6px;overflow:hidden"><img src="${esc(novaCapa)}" alt="" style="width:100%;height:100%;object-fit:cover"></div><button type="button" class="btn sec mini" data-act="semcapa">Remover capa</button></div>` : ''; };
  desenha(); previa();
  f.nt.addEventListener('input', () => desenha());
  f.nome.addEventListener('input', () => avisoDup({ tipo, nome: f.nome.value, ano: meta.ano, tmdb: meta.tmdb }));
  const busca = async () => {
    const q = $('#tq').value.trim(), res = $('#res'); if (!q) return;
    res.innerHTML = '<p class="aviso">Buscando…</p>';
    try {
      const R = (await tmdb({ acao: 'busca', tipo, q })).resultados;
      res.innerHTML = R.length ? R.map(x => `<button type="button" class="r" data-tid="${x.id}"><div class="p">${x.poster ? `<img src="${esc(x.poster)}" alt="">` : ''}</div><span><b>${esc(x.nome)}</b><small>${esc(x.ano)}</small></span></button>`).join('') : '<p class="aviso">Nada encontrado.</p>';
    } catch (e) { res.innerHTML = `<p class="aviso">${esc(e.auth ? 'Sessão expirada. Recarregue a página.' : e.message)}</p>`; }
  };
  $('#tb').addEventListener('click', busca);
  $('#tq').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); busca(); } });
  $('#res').addEventListener('click', async ev => {
    const b = ev.target.closest('[data-tid]'); if (!b) return;
    b.disabled = true;
    try {
      const d = await tmdb({ acao: 'detalhe', tipo, id: b.dataset.tid });
      f.nome.value = d.nome;
      if (!mv) { if (!d.eps.length) throw new Error('Esta série não tem temporadas no TMDb.'); f.nt.value = d.eps.length; desenha(d.eps); }
      if (d.poster) novaCapa = d.poster;
      previa();
      meta = { sinopse: d.sinopse, ano: d.ano, duracao: d.duracao, nota: d.nota, tmdb: d.tmdb };
      $('#res').innerHTML = '<p class="aviso">Dados preenchidos ✓ Confira e salve.</p>';
      avisoDup({ tipo, nome: d.nome, ano: d.ano, tmdb: d.tmdb });
    } catch (e) { $('#res').innerHTML = `<p class="aviso">${esc(e.auth ? 'Sessão expirada. Recarregue a página.' : e.message)}</p>`; }
  });
  f.capa.addEventListener('change', () => {
    const file = f.capa.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => {
      const W = 240, H = 360, c = document.createElement('canvas'); c.width = W; c.height = H;
      const k = Math.max(W / im.width, H / im.height), w = im.width * k, h = im.height * k;
      c.getContext('2d').drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
      novaCapa = c.toDataURL('image/jpeg', .7); previa(); };
      im.src = r.result; };
    r.readAsDataURL(file);
  });
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const eps = mv ? [1] : [...document.querySelectorAll('#temps input')].map(i => Math.max(1, Math.min(999, +i.value || 1)));
    const nome = f.nome.value.trim(); if (!nome || salvando) return;
    if (avisoDup({ tipo, nome, ano: meta.ano, tmdb: meta.tmdb })) { aviso('Esse título já está na sua estante.'); return; }
    salvando = true;
    const ok = f.querySelector('[type=submit]'); ok.disabled = true;
    const capaFinal = novaCapa && novaCapa.startsWith('data:') ? await enviarCapa(novaCapa) : novaCapa; // Blob, se configurado
    const sid = f.dataset.id, ex = sid ? achar(sid) : null;
    if (ex) {
      const antes = vis(ex);
      Object.assign(ex, meta); ex.nome = nome; ex.capa = capaFinal; ex.vis = eps.map((n, i) => Math.min(ex.vis[i] || 0, n)); ex.eps = eps;
      registrarProgresso(ex, antes); delete onde[ex.id]; aberta = ex.id;
    } else {
      L.series.unshift({ ...meta, tipo, id: uid(), criado: Date.now(), nome, capa: capaFinal, eps, vis: eps.map(() => 0) });
      aberta = null; V.UI.filtro = 'todas'; V.UI.busca = '';
    }
    save(); render();
    if (aberta) pintaDetalhe(); else dlg.close();
  });
  if (!dlg.open) dlg.showModal();
  f.nome.focus();
}

/* ---------- tops ---------- */
function addItem(tid) {
  const t = L.tops.find(x => x.id === tid), inp = document.querySelector(`[data-top="${tid}"] input`);
  const v = inp.value.trim(); if (!v || t.itens.length >= 10) return;
  const m = L.series.find(s => s.nome.toLowerCase() === v.toLowerCase());
  t.itens.push(m ? { t: m.nome, sid: m.id } : { t: v });
  save(); render();
  const novo = document.querySelector(`[data-top="${tid}"] .add input`); if (novo) novo.focus();
}
const moverItem = (t, de, para) => { const [x] = t.itens.splice(de, 1); t.itens.splice(para, 0, x); save(); };

// Arrastar pela alça (mouse, toque e caneta)
let arr = null;
document.addEventListener('pointerdown', e => {
  const h = e.target.closest('[data-alca]'); if (!h || e.button > 0) return;
  const li = h.closest('li'), ol = li.parentElement;
  arr = { li, ol, de: [...ol.children].indexOf(li), id: e.pointerId };
  li.classList.add('arrastando'); h.setPointerCapture(e.pointerId); e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!arr || e.pointerId !== arr.id) return;
  let ref = null;
  for (const o of [...arr.ol.children].filter(x => x !== arr.li)) { const r = o.getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { ref = o; break; } }
  if (ref !== arr.li.nextElementSibling) arr.ol.insertBefore(arr.li, ref);
});
const soltar = e => {
  if (!arr || e.pointerId !== arr.id) return;
  const { li, ol, de } = arr; arr = null; li.classList.remove('arrastando');
  const para = [...ol.children].indexOf(li), t = L.tops.find(x => x.id === li.closest('[data-top]').dataset.top);
  if (t && para !== de && para >= 0) moverItem(t, de, para);
  render();
};
document.addEventListener('pointerup', soltar);
document.addEventListener('pointercancel', soltar);

/* ---------- backup ---------- */
function backup() {
  aberta = null;
  dlg.innerHTML = `<h2>Backup</h2><p class="sub" style="margin-top:6px">Baixe um arquivo com todos os seus dados ou importe um backup (inclusive o da versão antiga). Itens com o mesmo id são substituídos; os demais são mantidos.</p>
    <div class="rodape-dlg esq"><button class="btn" data-act="exportar">Baixar backup (.json)</button>
      <label class="btn sec arq">Importar arquivo…<input type="file" id="bkarq" accept=".json,application/json" hidden></label></div>
    <details class="colar"><summary>Colar o texto de um backup</summary>
      <textarea id="bk" aria-label="Texto do backup" placeholder="Cole aqui o conteúdo do backup"></textarea>
      <div class="rodape-dlg"><button class="btn sec" data-act="importar">Importar texto</button></div></details>
    <div class="rodape-dlg"><button class="btn sec" data-act="fechar">Fechar</button></div>`;
  dlg.showModal();
}
function exportar() {
  const dados = { app: 'claquete', versao: 4, exportado: new Date().toISOString(), series: L.series, tops: L.tops };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
  a.download = `claquete-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function importar(texto) {
  let j;
  try { j = JSON.parse(texto); if (!j || !Array.isArray(j.series)) throw 0; } catch (e) { aviso('Backup inválido.'); return; }
  const t0 = Date.now(), limpo = ({ atualizado, base, ...x }) => x;
  const marca = (l, ok) => (l || []).filter(x => x && typeof x.id === 'string' && ok(x)).map((x, i) => ({ criado: t0 - i, ...limpo(x) }));
  const mescla = (novos, atuais) => { const ids = new Set(novos.map(x => x.id)); return [...novos, ...atuais.filter(x => !ids.has(x.id))]; };
  const { aceitos, repetidos } = semDuplicados(marca(j.series, x => x.nome && Array.isArray(x.eps) && Array.isArray(x.vis)), L.series);
  L.series = mescla(aceitos, L.series);
  L.tops = mescla(marca(j.tops, x => Array.isArray(x.itens)), L.tops);
  save(); dlg.close(); render();
  aviso(repetidos.length ? `Backup importado. ${repetidos.length} ${repetidos.length === 1 ? 'título repetido foi ignorado' : 'títulos repetidos foram ignorados'}.` : 'Backup importado.');
}
dlg.addEventListener('change', e => {
  if (e.target.id !== 'bkarq' || !e.target.files[0]) return;
  const r = new FileReader(); r.onload = () => importar(String(r.result)); r.readAsText(e.target.files[0]);
});

/* ---------- conta ---------- */
function conta() {
  aberta = null;
  dlg.innerHTML = `<h2>Minha conta</h2><p class="sub" style="margin-top:6px"><b>${esc(L.usuario.nome)}</b><br>${esc(L.usuario.email)}</p>
    <p class="aviso">“Sair de todos os dispositivos” encerra a sessão deste e de todos os outros aparelhos onde você entrou.</p>
    <div class="rodape-dlg"><button class="btn sec perigo" data-act="sair-todos">Sair de todos os dispositivos</button><button class="btn sec" data-act="sair">Sair</button><button class="btn" data-act="fechar">Fechar</button></div>`;
  dlg.showModal();
}

/* ---------- tema claro/escuro ---------- */
const SOL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const LUA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const escuro = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
function pintaTema() {
  const b = $('#tema'), d = escuro();
  b.innerHTML = d ? SOL : LUA; b.setAttribute('aria-label', d ? 'Mudar para o tema claro' : 'Mudar para o tema escuro');
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = d ? '#12121c' : '#f4f2fb';
}
function alternarTema() {
  const novo = escuro() ? 'light' : 'dark';
  document.documentElement.dataset.theme = novo; guardar('claq:tema', novo); pintaTema();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!ler('claq:tema')) pintaTema(); });

/* ---------- eventos ---------- */
function confirma(b, fn) {
  if (b.dataset.sure) { fn(); return; }
  b.dataset.sure = 1; const orig = b.textContent; b.textContent = 'Confirmar?';
  setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = orig; } }, 3000);
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, id = (b.closest('[data-id]') || {}).dataset?.id;
  const top = b.closest('[data-top]'), tid = top && top.dataset.top, li = b.closest('li'), i = li ? +li.dataset.i : -1;
  const s = id ? achar(id) : null, t = tid ? L.tops.find(x => x.id === tid) : null;
  if (a === 'filtro') { V.UI.filtro = b.dataset.k; renderLista(true); }
  else if (a === 'nova') formSerie(null, b.dataset.tipo);
  else if (a === 'abrir') { aberta = id || aberta || (b.closest('form') || {}).dataset?.id; if (aberta) pintaDetalhe(); }
  else if (a === 'fechar') { dlg.close(); }
  else if (a === 'mais' && s) { const p = prox(s); if (p) mexer(s, () => { s.vis[p[0] - 1]++; }); }
  else if (a === 'ep' && s) { const k = +b.dataset.s, n = +b.dataset.e; mexer(s, () => { s.vis[k] = s.vis[k] === n ? n - 1 : n; }); }
  else if (a === 'temp-tudo' && s) mexer(s, () => { s.vis[+b.dataset.s] = s.eps[+b.dataset.s]; });
  else if (a === 'temp-zero' && s) mexer(s, () => { s.vis[+b.dataset.s] = 0; });
  else if (a === 'visto' && s) mexer(s, () => { s.vis[0] = s.vis[0] ? 0 : 1; });
  else if (a === 'editar' && s) { salvaAvaliacao(); formSerie(s.id); }
  else if (a === 'semcapa') { novaCapa = null; b.closest('#previa').innerHTML = ''; }
  else if (a === 'atualizar-tmdb' && s) {
    const orig = b.textContent; b.disabled = true; b.textContent = 'Atualizando…';
    try {
      const r = await atualizarDoTmdb(s);
      if (r.erro) aviso(r.erro);
      else if (r.mudou.length) { aviso(r.voltouAssistir ? 'Há episódios novos! Progresso mantido.' : `Atualizado: ${r.mudou.join(', ')}.`); renderLista(); if (aberta === s.id) pintaDetalhe(); }
      else aviso('Já está em dia com o TMDb.');
    } catch (err) { aviso(err.rede ? 'Sem conexão com o TMDb.' : err.message); }
    if (b.isConnected) { b.disabled = false; b.textContent = orig; }
  }
  else if (a === 'completar-duracoes') {
    b.disabled = true;
    const r = await completarDuracoes((n, tot) => { b.textContent = `Buscando… ${n}/${tot}`; });
    aviso(r.ok ? `Duração completada em ${r.ok} ${r.ok === 1 ? 'título' : 'títulos'}.` : 'Não foi possível completar mais durações.'); render();
  }
  else if (a === 'del' && s) confirma(b, () => {
    L.series = L.series.filter(x => x.id !== s.id);
    L.tops.forEach(tp2 => tp2.itens.forEach(it => { if (it.sid === s.id) delete it.sid; }));
    delete onde[s.id]; save(); dlg.close(); render(); });
  else if (a === 'novo-top') { const v = $('#nt').value.trim(); if (v) { L.tops.unshift({ id: uid(), criado: Date.now(), nome: v, itens: [] }); save(); render(); } }
  else if (a === 'del-top' && t) confirma(b, () => { L.tops = L.tops.filter(x => x.id !== tid); save(); render(); });
  else if (a === 'add-item' && t) addItem(tid);
  else if (a === 'tira' && t) { t.itens.splice(i, 1); save(); render(); }
  else if (a === 'auth-modo') telaAuth(b.dataset.m);
  else if (a === 'recarregar') iniciar();
  else if (a === 'sair') sair(false);
  else if (a === 'sair-todos') confirma(b, () => sair(true));
  else if (a === 'backup') backup();
  else if (a === 'conta') conta();
  else if (a === 'tema') alternarTema();
  else if (a === 'exportar') exportar();
  else if (a === 'importar') importar($('#bk').value);
});

document.addEventListener('submit', e => { if (e.target.id === 'fa') { e.preventDefault(); enviarAuth(e.target); } });

document.addEventListener('input', e => { if (e.target.id === 'busca') { V.UI.busca = e.target.value; renderLista(); } });
document.addEventListener('change', e => {
  if (e.target.id === 'ordem') { V.UI.ordem = e.target.value; guardar('claq:ordem', V.UI.ordem); renderLista(true); }
});

document.addEventListener('keydown', e => {
  const alca = e.target.closest && e.target.closest('[data-alca]');
  if (alca && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {   // reordenar pelo teclado
    e.preventDefault();
    const li = alca.closest('li'), tp2 = alca.closest('[data-top]'), t = L.tops.find(x => x.id === tp2.dataset.top);
    const de = +li.dataset.i, para = de + (e.key === 'ArrowUp' ? -1 : 1);
    if (!t || para < 0 || para >= t.itens.length) return;
    moverItem(t, de, para); render();
    document.querySelector(`[data-top="${t.id}"] li[data-i="${para}"] [data-alca]`)?.focus();
    return;
  }
  if (e.key !== 'Enter') return;
  if (e.target.matches('.add input')) { e.preventDefault(); addItem(e.target.closest('[data-top]').dataset.top); }
  else if (e.target.id === 'nt') { e.preventDefault(); document.querySelector('[data-act="novo-top"]').click(); }
});

/* ---------- vários aparelhos: atualizar ao voltar para a aba ---------- */
const ocupado = () => dlg.open || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) || !!arr;
document.addEventListener('visibilitychange', () => { if (!document.hidden && logado) recarregarSuave({ ocupado }); });
addEventListener('focus', () => { if (logado) recarregarSuave({ ocupado }); });
addEventListener('online', () => { if (logado) recarregarSuave({ ocupado }); });

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

pintaTema();
ligarRede();
iniciar();
