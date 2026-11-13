// Ponto de entrada: renderiza a aba atual, inicia a sessão e despacha os cliques para o módulo de cada tela (telas/).
import { $, esc, status, aviso, desfazerUltimo, guardar, lerJSON, observarEstilos } from './util.js';
import { L, achar, carregar, ligar, ligarRede, recarregarSuave } from './loja.js';
import { lancamento, proximosLancamentos, hojeISO } from './regras.js';
import * as V from './views.js';
import { migrarCapas } from './capas.js';
import { atualizarAutomatico } from './tmdbsync.js';
import { app, dlg, ctx, gancho, aba, tipoAtual, naLista, revela } from './telas/ctx.js';
import * as estante from './telas/estante.js';
import * as detalhe from './telas/detalhe.js';
import * as formulario from './telas/formulario.js';
import * as tops from './telas/tops.js';
import * as backup from './telas/backup.js';
import * as conta from './telas/conta.js';
import * as descobrir from './telas/descobrir.js';
import * as compartilhar from './telas/compartilhar.js';
import * as importar from './telas/importar.js';
import * as tema from './telas/tema.js';
import * as notificacoes from './telas/notificacoes.js';

observarEstilos(); // aplica os estilos vindos de data-* (o CSP não aceita style="" no HTML)

/* ---------- renderização ---------- */
const TITULOS = { '#series': 'Séries', '#filmes': 'Filmes', '#descobrir': 'Descobrir', '#tops': 'Tops', '#stats': 'Estatísticas' };

function render() {
  if (!ctx.logado) return;
  const a = aba(),
    y = scrollY,
    manter = !ctx.animar;
  document.title = `${TITULOS[a]} · SóMaisUmEp`; // o leitor de tela anuncia o título ao trocar de aba
  document.querySelectorAll('.menu a').forEach(l => {
    if (l.getAttribute('href') === a) l.setAttribute('aria-current', 'page');
    else l.removeAttribute('aria-current');
  });
  app.classList.toggle('entra', ctx.animar);
  ctx.animar = false; // anima só ao trocar de aba, não a cada +1 episódio
  app.innerHTML =
    a === '#tops' ? V.viewTops() : a === '#stats' ? V.viewStats() : a === '#descobrir' ? V.viewDescobrir(descobrir.descDados()) : V.viewLista(tipoAtual());
  revela();
  if (a === '#descobrir') descobrir.carregaDescobrir(V.UI.descTipo);
  if (manter) scrollTo({ top: y, behavior: 'instant' });
}

const refresca = () => {
  if (naLista()) estante.renderLista();
  else if (aba() === '#stats') render();
  else if (aba() === '#descobrir') descobrir.pintaDesc();
};

addEventListener('hashchange', () => {
  ctx.animar = true;
  V.UI.busca = '';
  scrollTo({ top: 0, behavior: 'instant' });
  render();
  // Ao trocar de aba o foco vai para o título da página nova (sem isso, quem usa teclado ou leitor de tela fica "perdido" no menu).
  const h1 = app.querySelector('h1');
  if (h1 && ctx.logado) {
    h1.tabIndex = -1;
    h1.focus({ preventScroll: true });
  }
});

// Imagens entram com fade quando terminam de carregar (load/error não borbulham: captura).
const mostra = e => {
  if (e.target.tagName === 'IMG') e.target.classList.add('ok');
};
document.addEventListener('load', mostra, true);
document.addEventListener('error', mostra, true);

/* ---------- início ---------- */
async function iniciar() {
  app.classList.remove('entra');
  app.innerHTML = V.esqueleto(location.hash);
  try {
    const r = await carregar();
    ctx.logado = true;
    document.body.classList.remove('deslogado');
    $('#conta').textContent = (L.usuario.nome.trim()[0] || '?').toUpperCase();
    ctx.animar = true;
    status(r.offline ? 'Sem conexão' : 'Salvo ✓');
    render();
    if (!r.offline) depois();
  } catch (e) {
    if (e.auth) conta.telaAuth('entrar');
    else
      app.innerHTML = `<div class="vazio">Não foi possível carregar seus dados: ${esc(e.message)}<br><small>Se persistir, confira as variáveis de ambiente e o banco (veja o README, "Se aparecer erro no servidor").</small><br><br><button class="btn mini" data-act="recarregar">Tentar de novo</button></div>`;
  }
}

// Tarefas em segundo plano depois de abrir: capas para o Blob e temporadas novas.
async function depois() {
  avisosDeHoje();
  notificacoes.sincronizarPush(); // sem await: não atrasa o resto
  try {
    await migrarCapas();
  } catch {
    /* tenta de novo na próxima abertura */
  }
  await atualizarAutomatico({
    aoMudar: (s, r) => {
      const l = lancamento(s);
      aviso(r.voltouAssistir || r.agendou ? `Novos episódios de ${s.nome}!${l ? ' ' + l.texto + '.' : ''}` : `${s.nome} atualizado (${r.mudou.join(', ')}).`);
      refresca();
    },
  });
}

// Uma vez por dia (por título): avisa o que sai hoje entre os títulos da estante.
function avisosDeHoje() {
  const hoje = hojeISO(),
    feito = lerJSON('smue:hoje', {}),
    vistos = feito.dia === hoje ? feito.ids || [] : [];
  const novos = proximosLancamentos(L.series, { dias: 0, max: 99 }).filter(x => !vistos.includes(x.s.id));
  if (!novos.length) return;
  guardar('smue:hoje', { dia: hoje, ids: [...vistos, ...novos.map(x => x.s.id)] });
  const n = novos.map(x => x.s.nome),
    mostra = n.slice(0, 3);
  const lista =
    n.length > 3
      ? `${mostra.join(', ')} e mais ${n.length - 3}`
      : mostra.length > 1
        ? `${mostra.slice(0, -1).join(', ')} e ${mostra[mostra.length - 1]}`
        : mostra[0];
  aviso(`Sai hoje: ${lista}`, 7000);
}

// O que as telas usam para pedir algo ao main.js.
Object.assign(gancho, { render, pintaDetalhe: detalhe.pintaDetalhe, telaAuth: conta.telaAuth, iniciar });
ligar({
  render: () => {
    render();
    if (ctx.aberta && dlg.open && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) detalhe.pintaDetalhe();
  },
  login: () => conta.telaAuth('entrar'),
});

/* ---------- eventos ---------- */
// Ações que não pertencem a uma tela só.
const geral = {
  pular: () => app.focus({ preventScroll: false }), // "Pular para o conteúdo"
  fechar: () => dlg.close(),
  recarregar: () => iniciar(),
};
// Cada tela exporta `acoes`: { data-act: função }. Juntas formam a tabela de despacho (um nome só pode existir em uma tela).
const ACOES = {};
for (const tela of [geral, estante, detalhe, formulario, tops, backup, conta, descobrir, compartilhar, importar, tema, notificacoes]) {
  for (const [nome, fn] of Object.entries(tela.acoes || tela)) {
    if (nome in ACOES) throw new Error(`Ação duplicada: ${nome}`);
    ACOES[nome] = fn;
  }
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const fn = ACOES[b.dataset.act];
  if (!fn) return;
  const id = (b.closest('[data-id]') || {}).dataset?.id,
    top = b.closest('[data-top]'),
    tid = top && top.dataset.top,
    li = b.closest('li');
  await fn({
    b,
    id,
    tid,
    i: li ? +li.dataset.i : -1,
    s: id ? achar(id) : null,
    t: tid ? L.tops.find(x => x.id === tid) : null,
  });
});

document.addEventListener('submit', e => {
  const enviar = conta.formularios[e.target.id];
  if (enviar) {
    e.preventDefault();
    enviar(e.target);
  }
});

// Ctrl/⌘+Z desfaz a última ação que mostrou o aviso "Desfazer".
document.addEventListener('keydown', e => {
  if (
    (e.ctrlKey || e.metaKey) &&
    !e.shiftKey &&
    !e.altKey &&
    e.key.toLowerCase() === 'z' &&
    !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName) &&
    desfazerUltimo()
  )
    e.preventDefault();
});

/* ---------- vários aparelhos: atualizar ao voltar para a aba ---------- */
const ocupado = () => dlg.open || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) || tops.arrastando();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ctx.logado) recarregarSuave({ ocupado });
});
addEventListener('focus', () => {
  if (ctx.logado) recarregarSuave({ ocupado });
});
addEventListener('online', () => {
  if (ctx.logado) recarregarSuave({ ocupado });
});

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

tema.pintaTema();
ligarRede();
if (conta.temTokenReset()) conta.telaAuth('redefinir');
else iniciar();
