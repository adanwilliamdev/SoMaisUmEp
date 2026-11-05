import { $, esc, uid, status, aviso, avisoDesfazer, desfazerUltimo, guardar, ler, lerJSON, observarEstilos } from './util.js';
import { api, tmdb } from './api.js';
import { L, achar, save, carregar, ligar, ligarRede, recarregarSuave, limparSnap, zerar, pendente } from './loja.js';
import { tp, vis, estado, prox, registrarProgresso, acharDuplicado, semDuplicados, naEstante, sementes, lancamento, proximosLancamentos, hojeISO, limparTituloBackup, limparTopBackup } from './regras.js';
import * as V from './views.js';
import { enviarCapa, migrarCapas } from './capas.js';
import { atualizarDoTmdb, atualizarAutomatico, completarDuracoes, ondeAssistir, emAlta, parecidos, detalheTmdb } from './tmdbsync.js';
import { lerZip, lerArquivo, consolidar, resumoImportacao, montarTitulo, limitarImportacao, MAX_IMPORTACAO } from './importacao.js';
import { gerarImagem, enviarImagem, definirLink, urlPublica, copiar } from './compartilhar.js';

const app = $('#app'), dlg = $('#dlg');
observarEstilos(); // aplica os estilos vindos de data-* (o CSP não aceita style="" no HTML)
let logado = false, aberta = null, novaCapa, animar = true;
const onde = {}; // id -> 'carregando' | 'erro' | dados | null (cache da tela "Onde assistir")

/* ---------- abas e renderização ---------- */
const aba = () => (['#tops', '#filmes', '#stats', '#descobrir'].includes(location.hash) ? location.hash : '#series');
const tipoAtual = () => (aba() === '#filmes' ? 'movie' : 'tv');
const naLista = () => aba() === '#series' || aba() === '#filmes';

function render() {
  if (!logado) return;
  const a = aba(), y = scrollY, manter = !animar;
  document.querySelectorAll('.menu a').forEach(l => { if (l.getAttribute('href') === a) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
  app.classList.toggle('entra', animar); animar = false; // anima só ao trocar de aba, não a cada +1 episódio
  app.innerHTML = a === '#tops' ? V.viewTops() : a === '#stats' ? V.viewStats() : a === '#descobrir' ? V.viewDescobrir(descDados()) : V.viewLista(tipoAtual());
  revela();
  if (a === '#descobrir') carregaDescobrir(V.UI.descTipo);
  if (manter) scrollTo({ top: y, behavior: 'instant' });
}

// Atualiza só a lista (busca, filtro, ordem) sem mexer no campo de busca nem na rolagem.
function renderLista(anim = false) {
  if (!naLista() || !$('#lista')) return render();
  const t = tipoAtual();
  app.classList.toggle('entra', anim);
  $('#stats').innerHTML = V.htmlStats(t); $('#proximos').innerHTML = V.htmlProximos(t); $('#continuar').innerHTML = V.htmlContinuar(t); $('#lista').innerHTML = V.htmlLista(t);
  document.querySelectorAll('[data-act="filtro"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === V.UI.filtro));
  revela();
}

// Troca só o(s) card(s) do título alterado (e os números do topo). Se o estado mudou, o filtro pode mudar: refaz a lista.
function patchCard(id, mudouEstado) {
  if (!naLista() || !$('#stats')) return;
  if (mudouEstado) return renderLista();
  const s = achar(id); if (!s) return;
  $('#stats').innerHTML = V.htmlStats(tipoAtual());
  document.querySelectorAll(`.card[data-id="${CSS.escape(String(id))}"]`).forEach(el => {
    const t = document.createElement('template'); t.innerHTML = (el.classList.contains('cc') ? V.cardContinuar : V.cardHtml)(s, +el.style.getPropertyValue('--i') || 0);
    el.replaceWith(t.content.firstElementChild);
  });
  revela();
}
const refresca = () => { if (naLista()) renderLista(); else if (aba() === '#stats') render(); else if (aba() === '#descobrir') pintaDesc(); };

// Marca progresso: registra histórico, salva e atualiza só o que mudou na tela.
// `rotuloDesfazer`: texto do aviso com botão "Desfazer" (só fora do painel de detalhes, onde o aviso ficaria atrás dele).
function mexer(s, fn, rotuloDesfazer) {
  const antes = vis(s), est = estado(s), ant = { vis: [...s.vis], visto_em: s.visto_em, hist: s.hist };
  fn(); registrarProgresso(s, antes); save();
  patchCard(s.id, est !== estado(s));
  if (aberta === s.id) pintaDetalhe();
  if (rotuloDesfazer && !dlg.open) avisoDesfazer(rotuloDesfazer, () => {
    const x = achar(s.id); if (!x) return;                              // foi excluído nesse meio tempo
    const e0 = estado(x);
    x.vis = ant.vis;
    for (const k of ['visto_em', 'hist']) { if (ant[k] === undefined) delete x[k]; else x[k] = ant[k]; }
    save(); patchCard(x.id, e0 !== estado(x));
  });
}

addEventListener('hashchange', () => { animar = true; V.UI.busca = ''; scrollTo({ top: 0, behavior: 'instant' }); render(); });

// Imagens entram com fade quando terminam de carregar (load/error não borbulham: captura).
const mostra = e => { if (e.target.tagName === 'IMG') e.target.classList.add('ok'); };
document.addEventListener('load', mostra, true);
document.addEventListener('error', mostra, true);
function revela() { document.querySelectorAll('img.fade:not(.ok)').forEach(i => { if (i.complete && i.naturalWidth) i.classList.add('ok'); }); }

/* ---------- entrar / criar conta ---------- */
// Link de redefinição de senha do e-mail: "/#redefinir=<token>". O token sai da barra de endereço na hora.
let tokenReset = null;
{ const m = /^#redefinir=([a-f0-9]{64})$/.exec(location.hash); if (m) { tokenReset = m[1]; history.replaceState(null, '', location.pathname + location.search); } }

function telaAuth(modo = 'entrar') {
  logado = false; document.body.classList.add('deslogado'); if (dlg.open) dlg.close();
  app.classList.remove('entra');
  app.innerHTML = modo === 'esqueci' ? V.viewEsqueci() : modo === 'redefinir' ? V.viewRedefinir() : V.viewAuth(modo);
  ({ criar: () => $('#fa').nome, redefinir: () => $('#fr').senha, esqueci: () => $('#fe').email }[modo] || (() => $('#fa').email))().focus();
}
async function enviarEsqueci(f) {
  const m = $('#msg'), btn = f.querySelector('[type=submit]');
  m.textContent = ''; btn.disabled = true;
  try {
    await api('/api/esqueci', { method: 'POST', body: { email: f.email.value } });
    f.innerHTML = '<p class="aviso">Se esse e-mail tiver uma conta, o link já está a caminho (olhe também o spam). Ele vale por 1 hora.</p>';
  } catch (e) { m.textContent = e.message; btn.disabled = false; }
}
async function enviarRedefinir(f) {
  const m = $('#msg'), btn = f.querySelector('[type=submit]');
  m.textContent = '';
  if (f.senha.value !== f.senha2.value) { m.textContent = 'As senhas não são iguais.'; return; }
  btn.disabled = true;
  try {
    await api('/api/redefinir', { method: 'POST', body: { token: tokenReset, senha: f.senha.value } });
    tokenReset = null; telaAuth('entrar'); aviso('Senha alterada! Entre com a nova senha.');
  } catch (e) { m.textContent = e.message; btn.disabled = false; }
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
  limparSnap(); zerar(); for (const k in onde) delete onde[k]; desc.tv = desc.movie = null; telaAuth('entrar');
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
  avisosDeHoje();
  try { await migrarCapas(); } catch (e) { /* tenta de novo na próxima abertura */ }
  await atualizarAutomatico({ aoMudar: (s, r) => {
    const l = lancamento(s);
    aviso(r.voltouAssistir || r.agendou ? `Novos episódios de ${s.nome}!${l ? ' ' + l.texto + '.' : ''}` : `${s.nome} atualizado (${r.mudou.join(', ')}).`);
    refresca();
  } });
}

// Uma vez por dia (por título): avisa o que sai hoje entre os títulos da estante.
function avisosDeHoje() {
  const hoje = hojeISO(), feito = lerJSON('claq:hoje', {}), vistos = feito.dia === hoje ? feito.ids || [] : [];
  const novos = proximosLancamentos(L.series, { dias: 0, max: 99 }).filter(x => !vistos.includes(x.s.id));
  if (!novos.length) return;
  guardar('claq:hoje', { dia: hoje, ids: [...vistos, ...novos.map(x => x.s.id)] });
  const n = novos.map(x => x.s.nome), mostra = n.slice(0, 3);
  const lista = n.length > 3 ? `${mostra.join(', ')} e mais ${n.length - 3}` : mostra.length > 1 ? `${mostra.slice(0, -1).join(', ')} e ${mostra[mostra.length - 1]}` : mostra[0];
  aviso(`Sai hoje: ${lista}`, 7000);
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
  let meta = s ? { sinopse: s.sinopse, ano: s.ano, duracao: s.duracao, nota: s.nota, tmdb: s.tmdb, proximo: s.proximo || null } : {};
  aberta = null;
  dlg.innerHTML = `<h2>${s ? 'Editar' : mv ? 'Novo' : 'Nova'} ${mv ? 'filme' : 'série'}</h2><br>
    <form id="f" data-id="${s ? esc(s.id) : ''}">
      <label>Nome<input type="text" name="nome" required maxlength="80" value="${s ? esc(s.nome) : ''}"></label>
      <label>Buscar no TMDb (opcional)<span class="linha-busca"><input type="text" id="tq" placeholder="${mv ? 'Nome do filme' : 'Nome da série'}"><button type="button" class="btn mini" id="tb">Buscar</button></span></label>
      <div id="res" class="res"></div>
      <div id="dup"></div>
      <div id="blocotemp" ${mv ? 'hidden' : ''}><label>Número de temporadas<input type="number" name="nt" min="1" max="30" value="${s ? s.eps.length : 1}"></label>
      <div class="rotulo-eps">Episódios por temporada</div>
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
  const previa = () => { $('#previa').innerHTML = novaCapa ? `<div class="previa-cab"><div class="previa-img"><img src="${esc(novaCapa)}" alt="" ></div><button type="button" class="btn sec mini" data-act="semcapa">Remover capa</button></div>` : ''; };
  desenha(); previa();
  f.nt.addEventListener('input', () => desenha());
  f.nome.addEventListener('input', () => avisoDup({ tipo, nome: f.nome.value, ano: meta.ano, tmdb: meta.tmdb }));
  const busca = async () => {
    const q = $('#tq').value.trim(), res = $('#res'); if (!q) return;
    res.innerHTML = '<p class="aviso">Buscando…</p>';
    try {
      const R = (await tmdb({ acao: 'busca', tipo, q })).resultados;
      res.innerHTML = R.length ? R.map(x => `<button type="button" class="r" data-tid="${esc(x.id)}"><div class="p">${x.poster ? `<img src="${esc(x.poster)}" alt="">` : ''}</div><span><b>${esc(x.nome)}</b><small>${esc(x.ano)}</small></span></button>`).join('') : '<p class="aviso">Nada encontrado.</p>';
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
      meta = { sinopse: d.sinopse, ano: d.ano, duracao: d.duracao, nota: d.nota, tmdb: d.tmdb, proximo: d.proximo || null };
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
  const t = L.tops.find(x => x.id === tid), inp = document.querySelector(`[data-top="${CSS.escape(String(tid))}"] input`);
  const v = inp.value.trim(); if (!v || t.itens.length >= 10) return;
  const m = L.series.find(s => s.nome.toLowerCase() === v.toLowerCase());
  t.itens.push(m ? { t: m.nome, sid: m.id } : { t: v });
  save(); render();
  const novo = document.querySelector(`[data-top="${CSS.escape(String(tid))}"] .add input`); if (novo) novo.focus();
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
  dlg.innerHTML = `<h2>Backup</h2><p class="sub topo6">Baixe um arquivo com todos os seus dados ou importe um backup (inclusive o da versão antiga). Itens com o mesmo id são substituídos; os demais são mantidos.</p>
    <div class="rodape-dlg esq"><button class="btn" data-act="exportar">Baixar backup (.json)</button>
      <label class="btn sec arq">Importar arquivo…<input type="file" id="bkarq" accept=".json,application/json" hidden></label></div>
    <details class="colar"><summary>Colar o texto de um backup</summary>
      <textarea id="bk" aria-label="Texto do backup" placeholder="Cole aqui o conteúdo do backup"></textarea>
      <div class="rodape-dlg"><button class="btn sec" data-act="importar">Importar texto</button></div></details>
    <div class="rodape-dlg"><button class="btn sec" data-act="fechar">Fechar</button></div>`;
  dlg.showModal();
}
function exportar() {
  const dados = { app: 'somaisumep', versao: 4, exportado: new Date().toISOString(), series: L.series, tops: L.tops };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
  a.download = `somaisumep-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function importar(texto) {
  let j;
  try { j = JSON.parse(texto); if (!j || !Array.isArray(j.series)) throw 0; } catch (e) { aviso('Backup inválido.'); return; }
  // Cada item passa pelo saneamento (ids, números, capas, textos) antes de entrar no app; o que não passar é descartado.
  const t0 = Date.now(), MAX_SERIES = 5000, MAX_TOPS = 200;
  const recebidos = j.series.length + (Array.isArray(j.tops) ? j.tops.length : 0);
  const series = j.series.slice(0, MAX_SERIES).map((x, i) => limparTituloBackup(x, t0 - i)).filter(Boolean);
  const tops = (Array.isArray(j.tops) ? j.tops : []).slice(0, MAX_TOPS).map((x, i) => limparTopBackup(x, t0 - i)).filter(Boolean);
  const invalidos = recebidos - series.length - tops.length;
  const mescla = (novos, atuais) => { const ids = new Set(novos.map(x => x.id)); return [...novos, ...atuais.filter(x => !ids.has(x.id))]; };
  const { aceitos, repetidos } = semDuplicados(series, L.series);
  L.series = mescla(aceitos, L.series);
  L.tops = mescla(tops, L.tops);
  save(); dlg.close(); render();
  const notas = [];
  if (repetidos.length) notas.push(`${repetidos.length} ${repetidos.length === 1 ? 'título repetido foi ignorado' : 'títulos repetidos foram ignorados'}`);
  if (invalidos > 0) notas.push(`${invalidos} ${invalidos === 1 ? 'item inválido foi descartado' : 'itens inválidos foram descartados'}`);
  aviso(notas.length ? `Backup importado. ${notas.join('; ')}.` : 'Backup importado.');
}
dlg.addEventListener('change', e => {
  if (e.target.id !== 'bkarq' || !e.target.files[0]) return;
  const r = new FileReader(); r.onload = () => importar(String(r.result)); r.readAsText(e.target.files[0]);
});

/* ---------- conta ---------- */
function conta() {
  aberta = null;
  dlg.innerHTML = `<h2>Minha conta</h2><p class="sub topo6"><b>${esc(L.usuario.nome)}</b><br>${esc(L.usuario.email)}</p>
    <p class="aviso">“Sair de todos os dispositivos” encerra a sessão deste e de todos os outros aparelhos onde você entrou.</p>
    <div class="rodape-dlg esq"><button class="btn sec" data-act="conta-senha">Trocar senha</button><button class="btn sec" data-act="conta-email">Trocar e-mail</button><button class="btn sec perigo" data-act="conta-excluir">Excluir conta</button></div>
    <div class="rodape-dlg"><button class="btn sec perigo" data-act="sair-todos">Sair de todos os dispositivos</button><button class="btn sec" data-act="sair">Sair</button><button class="btn" data-act="fechar">Fechar</button></div>`;
  if (!dlg.open) dlg.showModal();
}
function formConta(acao) {
  dlg.innerHTML = V.viewFormConta(acao, L.usuario.email);
  if (!dlg.open) dlg.showModal();
  dlg.querySelector('input').focus();
}
async function enviarConta(f) {
  const m = $('#msgc'), btn = f.querySelector('[type=submit]'), acao = f.dataset.acao;
  m.textContent = '';
  if (acao === 'senha' && f.nova.value !== f.nova2.value) { m.textContent = 'As senhas novas não são iguais.'; return; }
  if (acao === 'excluir' && !confirm('Excluir a conta definitivamente? Isso não pode ser desfeito.')) return;
  btn.disabled = true;
  const body = { acao, senha: f.atual.value, ...(acao === 'senha' ? { nova: f.nova.value } : acao === 'email' ? { email: f.email.value } : {}) };
  try {
    const r = await api('/api/conta', { method: 'POST', body });
    if (acao === 'excluir') { dlg.close(); limparSnap(); zerar(); for (const k in onde) delete onde[k]; desc.tv = desc.movie = null; telaAuth('criar'); aviso('Conta excluída.'); }
    else if (acao === 'email') { L.usuario.email = r.email; aviso('E-mail alterado.'); conta(); }
    else { aviso('Senha alterada. Os outros aparelhos foram desconectados.'); conta(); }
  } catch (e) { m.textContent = e.message; btn.disabled = false; }
}

/* ---------- descobrir ---------- */
const desc = { tv: null, movie: null };   // por tipo: { alta, parecidos } (lista, 'carregando', 'erro' ou null); guardado só durante a sessão
let descAberto = null;                    // { x, tipo }: título do TMDb aberto no painel
const descDados = () => desc[V.UI.descTipo] || { alta: 'carregando', parecidos: sementes(L.series, V.UI.descTipo).length ? 'carregando' : null };
const descItem = (tipo, tid) => {
  const d = desc[tipo] || {};
  for (const l of [d.parecidos, d.alta]) if (Array.isArray(l)) { const x = l.find(y => String(y.id) === String(tid)); if (x) return x; }
  return null;
};
function pintaDesc() { if (aba() === '#descobrir' && $('#desc')) { $('#desc').innerHTML = V.htmlDescobrir(V.UI.descTipo, descDados()); revela(); } }
async function carregaDescobrir(tipo) {
  if (desc[tipo]) return;
  const sem = sementes(L.series, tipo).map(s => s.tmdb);
  const d = desc[tipo] = { alta: 'carregando', parecidos: sem.length ? 'carregando' : null };
  const pega = (campo, p) => p.then(r => { d[campo] = r; }, e => { d[campo] = 'erro'; if (e.auth) telaAuth('entrar'); }).then(pintaDesc);
  await Promise.all([pega('alta', emAlta(tipo)), sem.length ? pega('parecidos', parecidos(tipo, sem)) : null]);
}
function abrirDescDetalhe(x, tipo) {
  aberta = null; descAberto = { x, tipo };
  const k = tipo + ':' + x.id;
  dlg.innerHTML = V.htmlDescDetalhe(x, tipo, onde[k] === undefined ? 'carregando' : onde[k]);
  if (!dlg.open) dlg.showModal();
  revela();
  if (onde[k] !== undefined) return;
  onde[k] = 'carregando';
  ondeAssistir({ tipo, tmdb: x.id }).then(r => { onde[k] = r; }, () => { onde[k] = 'erro'; }).then(() => {
    const el = $('#onde'); if (el && descAberto && descAberto.x.id === x.id) el.innerHTML = V.htmlOnde(onde[k]);
  });
}
dlg.addEventListener('close', () => { descAberto = null; });

async function adicionarDesc(tipo, tid, botao) {
  if (botao) botao.disabled = true;
  try {
    const d = await detalheTmdb(tipo, tid), mv = tipo === 'movie';
    if (!mv && !d.eps.length) { aviso('Esta série ainda não tem temporadas no TMDb.'); return; }
    const dup = acharDuplicado(L.series, { tipo, nome: d.nome, ano: d.ano, tmdb: d.tmdb });
    if (dup) { aviso(`${dup.nome} já está na sua estante.`); pintaDesc(); return; }
    const eps = mv ? [1] : d.eps;
    const s = { tipo, id: uid(), criado: Date.now(), nome: d.nome, capa: d.poster, sinopse: d.sinopse || null, ano: d.ano || null, nota: d.nota, duracao: d.duracao, tmdb: d.tmdb, eps, vis: eps.map(() => 0), proximo: d.proximo || null };
    L.series.unshift(s); save();
    if (dlg.open && descAberto) dlg.close();                            // o aviso com "Desfazer" não aparece por cima do painel
    pintaDesc();
    avisoDesfazer(`${s.nome} adicionad${mv ? 'o' : 'a'} à estante`, () => { L.series = L.series.filter(x => x.id !== s.id); save(); pintaDesc(); });
  } catch (e) { if (e.auth) telaAuth('entrar'); else aviso(e.rede ? 'Sem conexão com o TMDb.' : e.message); }
  finally { if (botao && botao.isConnected) botao.disabled = false; }
}

/* ---------- compartilhar top (imagem e link) ---------- */
let compart = null;   // { top, canvas, pronto }
function pintaCompartilhar() {
  const t = compart.top, codigo = L.links[t.id];
  dlg.innerHTML = V.htmlCompartilhar(t, codigo, codigo ? urlPublica(codigo) : '');
  if (!compart.pronto) return;
  const prev = $('#share-prev'); prev.removeAttribute('aria-busy'); prev.replaceChildren(compart.canvas);
  compart.canvas.setAttribute('role', 'img'); compart.canvas.setAttribute('aria-label', `Imagem do top ${t.nome}`);
  dlg.querySelector('[data-act="img-enviar"]').disabled = false;
  if (compart.semCapas) $('#share-msg').textContent = 'Não foi possível carregar as capas para a imagem; ela usa letras no lugar.';
}
async function abrirCompartilhar(t) {
  aberta = null;
  const c = compart = { top: t, canvas: document.createElement('canvas'), pronto: false, semCapas: false };
  pintaCompartilhar(); if (!dlg.open) dlg.showModal();
  const r = await gerarImagem(c.canvas, t);
  if (compart !== c) return;                                              // fechou ou abriu outro
  c.pronto = true; c.semCapas = r.semCapas;
  if (dlg.open && $('#share-prev')) pintaCompartilhar();
}
async function mudarLink(t, ativo, b) {
  if (b) b.disabled = true;
  try { await definirLink(t, ativo); pintaCompartilhar(); if (ativo) aviso('Link criado.'); }
  catch (e) { const m = $('#share-msg'); if (m) m.textContent = e.rede ? 'Sem conexão.' : e.message; if (b && b.isConnected) b.disabled = false; }
}
dlg.addEventListener('close', () => { compart = null; if (aba() === '#tops') render(); });

/* ---------- importar (Trakt, Letterboxd, IMDb) ---------- */
let imp = null;   // { entradas, fontes, parar, ids }
function abrirImportar() {
  aberta = null; imp = null;
  dlg.innerHTML = V.htmlImportar();
  if (!dlg.open) dlg.showModal();
}
dlg.addEventListener('close', () => { if (imp && !imp.rodando) imp = null; });
dlg.addEventListener('change', e => { if (e.target.id === 'imparq' && e.target.files.length) lerArquivosImportacao([...e.target.files]); });
async function lerArquivosImportacao(arquivos) {
  const msg = $('#imp-msg'); msg.textContent = 'Lendo os arquivos…';
  const todas = [], fontes = new Set();
  try {
    for (const f of arquivos) {
      if (f.size > 60e6) throw new Error(`${f.name} é grande demais (máximo 60 MB).`);
      const itens = /\.zip$/i.test(f.name) ? await lerZip(await f.arrayBuffer(), n => /\.csv$/i.test(n)) : [{ nome: f.name, texto: await f.text() }];
      for (const it of itens) { const r = lerArquivo(it.nome, it.texto); if (r) { todas.push(...r.entradas); fontes.add(r.fonte); } }
    }
  } catch (e) { msg.textContent = e.message; return; }
  const jaTem = e => !!acharDuplicado(L.series, { tipo: e.tipo, nome: e.nome, ano: e.ano ? String(e.ano) : null, tmdb: e.tmdb ? Number(e.tmdb) : null });
  const { entradas, cortadas } = limitarImportacao(consolidar(todas), jaTem);
  if (cortadas) aviso(`Importando os primeiros ${MAX_IMPORTACAO} títulos. Sobraram ${cortadas}: depois de terminar, importe os mesmos arquivos de novo para trazer o resto.`, 12000);
  if (!entradas.length) { msg.textContent = 'Não encontrei títulos nesses arquivos. Confira se são exports do Letterboxd, IMDb ou Trakt (veja as dicas acima).'; return; }
  imp = { entradas, fontes: [...fontes], parar: false, ids: [], rodando: false };
  dlg.innerHTML = V.htmlImportar({ previa: resumoImportacao(entradas), fontes: imp.fontes });
}
async function iniciarImportacao() {
  const total = imp.entradas.length, t0 = Date.now(), naoAchou = [];
  let feitos = 0, repetidos = 0, parou = false;
  const andamento = () => { const pct = Math.round(feitos / total * 100); dlg.innerHTML = V.htmlImportar({ andamento: { pct, texto: `Buscando no TMDb… ${feitos} de ${total}` } }); };
  imp.rodando = true; imp.parar = false; imp.ids = []; andamento();
  const barra = () => dlg.querySelector('.imp-barra');
  try {
    for (let i = 0; i < total; i += 10) {
      if (imp.parar) { parou = true; break; }
      const lote = imp.entradas.slice(i, i + 10), novos = [];
      const r = (await api('/api/tmdb', { method: 'POST', body: { itens: lote.map(e => ({ tipo: e.tipo, nome: e.nome, ano: e.ano, tmdb: e.tmdb, imdb: e.imdb })) } })).resultados;
      lote.forEach((e, k) => {
        const info = r[k], rot = e.nome + (e.ano ? ` (${e.ano})` : '');
        if (!info || !info.ok) { naoAchou.push(rot); return; }
        if (e.tipo === 'tv' && !info.eps.length) { naoAchou.push(rot + ' · sem temporadas no TMDb'); return; }
        const cand = { tipo: e.tipo, nome: info.nome, ano: info.ano, tmdb: info.tmdb };
        if (acharDuplicado(L.series, cand) || acharDuplicado(novos, cand)) { repetidos++; return; }
        novos.push(montarTitulo(e, info, { id: uid(), criado: t0 - (i + k) }));
      });
      if (novos.length) { L.series.unshift(...novos); imp.ids.push(...novos.map(x => x.id)); save(); }
      feitos += lote.length;
      const b = barra(); if (b) { b.setAttribute('aria-valuenow', Math.round(feitos / total * 100)); b.firstElementChild.style.width = Math.round(feitos / total * 100) + '%'; }
      const tx = $('#imp-txt'); if (tx) tx.textContent = `Buscando no TMDb… ${feitos} de ${total}`;
    }
  } catch (e) {
    if (e.auth) { imp.rodando = false; telaAuth('entrar'); return; }
    aviso(e.rede ? 'Sem conexão. A importação parou; o que já entrou foi mantido.' : e.message); parou = true;
  }
  imp.rodando = false;
  V.UI.filtro = 'todas'; V.UI.busca = '';
  dlg.innerHTML = V.htmlImportar({ fim: { novos: imp.ids.length, repetidos, naoAchou, parou } });
  if (imp.ids.length) dlg.querySelector('.rodape-dlg').insertAdjacentHTML('afterbegin', '<button class="btn sec perigo" data-act="importar-desfazer">Desfazer importação</button>');
  render();
}
function desfazerImportacao() {
  const ids = new Set(imp.ids);
  L.series = L.series.filter(s => !ids.has(s.id));
  save(); imp = null; dlg.close(); render(); aviso('Importação desfeita.');
}

/* ---------- tema claro/escuro ---------- */
const SOL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const LUA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const escuro = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
function pintaTema() {
  const b = $('#tema'), d = escuro();
  b.innerHTML = d ? SOL : LUA; b.setAttribute('aria-label', d ? 'Mudar para o tema claro' : 'Mudar para o tema escuro');
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = d ? '#120f1e' : '#f1eef8';
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
  else if (a === 'mais' && s) { const p = prox(s); if (p) mexer(s, () => { s.vis[p[0] - 1]++; }, tp(s) === 'movie' ? `${s.nome} marcado como visto` : `${s.nome}: T${p[0]} E${p[1]} marcado`); }
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
  else if (a === 'del-top' && t) confirma(b, () => {
    const pos = L.tops.indexOf(t), codigo = L.links[tid];
    L.tops = L.tops.filter(x => x.id !== tid); delete L.links[tid]; save(); render();
    avisoDesfazer(`Top “${t.nome}” excluído${codigo ? ' (o link público foi desligado)' : ''}`, () => { L.tops.splice(Math.min(pos, L.tops.length), 0, t); save(); render(); }, 9000);
  });
  else if (a === 'add-item' && t) addItem(tid);
  else if (a === 'tira' && t) {
    const [item] = t.itens.splice(i, 1); save(); render();
    avisoDesfazer(`${item.t} removido do top`, () => {
      if (!L.tops.includes(t)) return;
      if (t.itens.length >= 10) { aviso('O top já está cheio.'); return; }
      t.itens.splice(Math.min(i, t.itens.length), 0, item); save(); render();
    });
  }
  else if (a === 'auth-modo') telaAuth(b.dataset.m);
  else if (a === 'recarregar') iniciar();
  else if (a === 'sair') sair(false);
  else if (a === 'sair-todos') confirma(b, () => sair(true));
  else if (a === 'backup') backup();
  else if (a === 'conta') conta();
  else if (a === 'conta-senha' || a === 'conta-email' || a === 'conta-excluir') formConta(a.slice(6));
  else if (a === 'tema') alternarTema();
  else if (a === 'exportar') exportar();
  else if (a === 'importar') importar($('#bk').value);
  else if (a === 'desc-tipo') { V.UI.descTipo = b.dataset.k; render(); }
  else if (a === 'desc-recarregar') { desc[V.UI.descTipo] = null; render(); }
  else if (a === 'desc-abrir') { const tipo = V.UI.descTipo, x = descItem(tipo, b.closest('[data-tid]').dataset.tid); if (x) abrirDescDetalhe(x, tipo); }
  else if (a === 'desc-add') adicionarDesc(descAberto ? descAberto.tipo : V.UI.descTipo, b.closest('[data-tid]').dataset.tid, b);
  else if (a === 'compartilhar' && t) abrirCompartilhar(t);
  else if (a === 'img-enviar' && compart) { b.disabled = true; try { const r = await enviarImagem(compart.canvas, compart.top); if (r === 'baixado') aviso('Imagem baixada.'); } catch (err) { aviso(err.message); } b.disabled = false; }
  else if (a === 'link-criar' && t) await mudarLink(t, true, b);
  else if (a === 'link-desligar' && t) confirma(b, () => mudarLink(t, false, b));
  else if (a === 'link-copiar' && t) { const ok = await copiar(urlPublica(L.links[t.id])); if (!ok) $('#share-url').select(); aviso(ok ? 'Link copiado.' : 'Selecione o link e copie.'); }
  else if (a === 'importar-abrir') abrirImportar();
  else if (a === 'importar-iniciar' && imp) iniciarImportacao();
  else if (a === 'importar-parar' && imp) { imp.parar = true; b.disabled = true; b.textContent = 'Parando…'; }
  else if (a === 'importar-desfazer' && imp) desfazerImportacao();
});

document.addEventListener('submit', e => {
  const f = e.target, enviar = { fa: enviarAuth, fe: enviarEsqueci, fr: enviarRedefinir, fc: enviarConta }[f.id];
  if (enviar) { e.preventDefault(); enviar(f); }
});

document.addEventListener('input', e => { if (e.target.id === 'busca') { V.UI.busca = e.target.value; renderLista(); } });
document.addEventListener('change', e => {
  if (e.target.id === 'ordem') { V.UI.ordem = e.target.value; guardar('claq:ordem', V.UI.ordem); renderLista(true); }
});

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName) && desfazerUltimo()) { e.preventDefault(); return; }
  const alca = e.target.closest && e.target.closest('[data-alca]');
  if (alca && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {   // reordenar pelo teclado
    e.preventDefault();
    const li = alca.closest('li'), tp2 = alca.closest('[data-top]'), t = L.tops.find(x => x.id === tp2.dataset.top);
    const de = +li.dataset.i, para = de + (e.key === 'ArrowUp' ? -1 : 1);
    if (!t || para < 0 || para >= t.itens.length) return;
    moverItem(t, de, para); render();
    document.querySelector(`[data-top="${CSS.escape(String(t.id))}"] li[data-i="${para}"] [data-alca]`)?.focus();
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
if (tokenReset) telaAuth('redefinir'); else iniciar();
