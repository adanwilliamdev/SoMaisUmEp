// Descobrir: radar de afinidade pessoal (cruza só com o seu histórico), detalhe de um título do TMDb e adicionar à estante.
import { $, uid, aviso, avisoDesfazer, guardar, lerJSON } from '../util.js';
import { L, save } from '../loja.js';
import { acharDuplicado, sementesRadar, idsRadar, precisaLigar, normaliza, tp, vis } from '../regras.js';
import * as V from '../views.js';
import { ondeAssistir, radar, detalheTmdb } from '../tmdbsync.js';
import { tmdb } from '../api.js';
import { dlg, ctx, gancho, onde, aba, revela } from './ctx.js';

const desc = { tv: null, movie: null }; // por tipo: { chave, radar, quando } (radar: dados, 'carregando', 'erro' ou null); guardado só durante a sessão
const VALIDADE = 6 * 36e5; // depois de 6 h o radar é refeito sozinho quando você volta para a aba
const forcar = { tv: false, movie: false }; // "Atualizar": ignora o cache
const CHAVE_NAO = 'smue:descNao'; // títulos dispensados ("não tenho interesse"), por tipo, neste aparelho
const dispensados = tipo => (lerJSON(CHAVE_NAO, {})[tipo] || []).map(String);
let descAberto = null; // { x, tipo }: título do TMDb aberto no painel

export const limparDescobrir = () => {
  desc.tv = desc.movie = null;
};

// Títulos sem o id do TMDb (adicionados à mão): o app procura cada um pelo nome e guarda o resultado só neste aparelho
// ({ idDoTitulo: { t: idDoTMDb ou 0 se não achou, q: quando } }). Assim o radar parte também do que você está assistindo e nunca foi ligado.
const CHAVE_LIG = 'smue:descTmdb',
  SEMANA = 7 * 864e5;
const ligando = { tv: false, movie: false };
const tentados = () => Object.fromEntries(Object.entries(lerJSON(CHAVE_LIG, {})).filter(([, v]) => v && (v.t || Date.now() - v.q < SEMANA)));
const ligados = () =>
  Object.fromEntries(
    Object.entries(lerJSON(CHAVE_LIG, {}))
      .filter(([, v]) => v && v.t)
      .map(([id, v]) => [id, v.t]),
  );
const sementesDe = tipo => sementesRadar(L.series, tipo, 6, Date.now(), ligados());
const faltaLigar = tipo => precisaLigar(L.series, tipo, tentados());

async function ligarSementes(tipo, lista) {
  const todos = lerJSON(CHAVE_LIG, {});
  await Promise.all(
    lista.map(async s => {
      try {
        const r = (await tmdb({ acao: 'busca', tipo, q: s.nome })).resultados || [];
        const alvo = normaliza(s.nome);
        // Nome igual (e ano igual, se os dois têm); sem nome igual, vale o 1º resultado só se o ano bate (o TMDb também acha por título alternativo).
        const mesmoAno = x => !s.ano || !x.ano || String(s.ano) === String(x.ano);
        const ach = r.find(x => normaliza(x.nome) === alvo && mesmoAno(x)) || (s.ano && r[0] && String(r[0].ano) === String(s.ano) ? r[0] : null);
        todos[s.id] = { t: ach ? ach.id : 0, q: Date.now() };
      } catch (e) {
        if (e.auth) throw e; // outros erros (sem rede...): tenta de novo na próxima vez
      }
    }),
  );
  guardar(CHAVE_LIG, todos);
}

// A chave muda quando as sementes mudam (você concluiu ou avaliou algo): aí o radar é refeito.
const chaveRadar = tipo => idsRadar(sementesDe(tipo)).join(',');

export const descDados = () => {
  const tipo = V.UI.descTipo,
    d = desc[tipo],
    nao = dispensados(tipo),
    sementes = sementesDe(tipo);
  const lig = ligados(),
    tent = tentados();
  const semLigacao = L.series.filter(s => tp(s) === tipo && !s.tmdb && s.id in tent && !lig[s.id] && vis(s) > 0).map(s => s.nome);
  const base = { dispensados: nao, sementes, semLigacao };
  if (d && (d.radar === 'erro' || d.chave === chaveRadar(tipo))) return { ...d, ...base };
  const procurando = faltaLigar(tipo).length > 0;
  return { ...base, radar: procurando || chaveRadar(tipo) ? 'carregando' : null, procurando };
};

const descItem = (tipo, tid) => {
  const l = ((desc[tipo] || {}).radar || {}).resultados;
  return (Array.isArray(l) && l.find(y => String(y.id) === String(tid))) || null;
};

export function pintaDesc() {
  if (aba() === '#descobrir' && $('#desc')) {
    $('#desc').innerHTML = V.htmlDescobrir(V.UI.descTipo, descDados());
    revela();
  }
}

export async function carregaDescobrir(tipo) {
  if (ligando[tipo]) return;
  const falta = faltaLigar(tipo).slice(0, 8);
  if (falta.length) {
    ligando[tipo] = true;
    try {
      await ligarSementes(tipo, falta);
    } catch (e) {
      if (e.auth) gancho.telaAuth('entrar');
    }
    ligando[tipo] = false;
    if (V.UI.descTipo !== tipo) return;
  }
  const chave = chaveRadar(tipo),
    atual = desc[tipo];
  if (atual && atual.chave === chave) {
    const velho = Date.now() - (atual.quando || 0) > VALIDADE;
    if (atual.radar === 'carregando' || (!velho && atual.radar !== 'erro')) {
      if (falta.length) pintaDesc();
      return;
    }
  }
  if (!chave) {
    desc[tipo] = { chave, radar: null };
    pintaDesc();
    return;
  }
  const d = (desc[tipo] = { chave, radar: 'carregando' });
  if (falta.length) pintaDesc();
  try {
    d.radar = await radar(tipo, chave.split(','), forcar[tipo]);
    d.quando = Date.now();
  } catch (e) {
    d.radar = 'erro';
    d.erro = e.auth ? '' : e.message || '';
    if (e.auth) gancho.telaAuth('entrar');
  }
  forcar[tipo] = false;
  if (desc[tipo] === d) pintaDesc();
}

function abrirDescDetalhe(x, tipo) {
  ctx.aberta = null;
  descAberto = { x, tipo };
  const k = tipo + ':' + x.id;
  dlg.innerHTML = V.htmlDescDetalhe(x, tipo, onde[k] === undefined ? 'carregando' : onde[k]);
  if (!dlg.open) dlg.showModal();
  revela();
  if (onde[k] !== undefined) return;
  onde[k] = 'carregando';
  ondeAssistir({ tipo, tmdb: x.id })
    .then(
      r => {
        onde[k] = r;
      },
      () => {
        onde[k] = 'erro';
      },
    )
    .then(() => {
      const el = $('#onde');
      if (el && descAberto && descAberto.x.id === x.id) el.innerHTML = V.htmlOnde(onde[k]);
    });
}
dlg.addEventListener('close', () => {
  descAberto = null;
});

async function adicionarDesc(tipo, tid, botao) {
  if (botao) botao.disabled = true;
  try {
    const d = await detalheTmdb(tipo, tid),
      mv = tipo === 'movie';
    if (!mv && !d.eps.length) {
      aviso('Esta série ainda não tem temporadas no TMDb.');
      return;
    }
    const dup = acharDuplicado(L.series, { tipo, nome: d.nome, ano: d.ano, tmdb: d.tmdb });
    if (dup) {
      aviso(`${dup.nome} já está na sua estante.`);
      pintaDesc();
      return;
    }
    const eps = mv ? [1] : d.eps;
    const s = {
      tipo,
      id: uid(),
      criado: Date.now(),
      nome: d.nome,
      capa: d.poster,
      sinopse: d.sinopse || null,
      ano: d.ano || null,
      nota: d.nota,
      duracao: d.duracao,
      tmdb: d.tmdb,
      eps,
      vis: eps.map(() => 0),
      proximo: d.proximo || null,
    };
    L.series.unshift(s);
    save();
    if (dlg.open && descAberto) dlg.close(); // o aviso com "Desfazer" não aparece por cima do painel
    pintaDesc();
    avisoDesfazer(`${s.nome} adicionad${mv ? 'o' : 'a'} à estante`, () => {
      L.series = L.series.filter(x => x.id !== s.id);
      save();
      pintaDesc();
    });
  } catch (e) {
    if (e.auth) gancho.telaAuth('entrar');
    else aviso(e.rede ? 'Sem conexão com o TMDb.' : e.message);
  } finally {
    if (botao && botao.isConnected) botao.disabled = false;
  }
}

// "Por que estou vendo isso?": abre/fecha o balão (no computador ele também aparece ao passar o mouse). Só um aberto por vez.
function fecharPorques(menos) {
  document.querySelectorAll('.porque.aberto').forEach(p => {
    if (p === menos) return;
    p.classList.remove('aberto');
    p.querySelector('.porque-btn')?.setAttribute('aria-expanded', 'false');
  });
}
document.addEventListener('click', e => {
  if (!e.target.closest('.porque')) fecharPorques();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') fecharPorques();
});

export const acoes = {
  porque: ({ b }) => {
    const p = b.closest('.porque'),
      abrir = !p.classList.contains('aberto');
    fecharPorques(p);
    p.classList.toggle('aberto', abrir);
    b.setAttribute('aria-expanded', String(abrir));
  },
  'desc-tipo': ({ b }) => {
    V.UI.descTipo = b.dataset.k;
    gancho.render();
  },
  'desc-recarregar': () => {
    forcar[V.UI.descTipo] = true;
    desc[V.UI.descTipo] = null;
    gancho.render();
  },
  'desc-dispensar': ({ b }) => {
    const tipo = V.UI.descTipo,
      tid = String(b.closest('[data-tid]').dataset.tid),
      x = descItem(tipo, tid);
    const todos = lerJSON(CHAVE_NAO, {});
    todos[tipo] = [...new Set([...(todos[tipo] || []).map(String), tid])].slice(-300);
    guardar(CHAVE_NAO, todos);
    pintaDesc();
    avisoDesfazer(`${x ? x.nome : 'Título'} não vai mais aparecer`, () => {
      const t = lerJSON(CHAVE_NAO, {});
      t[tipo] = (t[tipo] || []).map(String).filter(i => i !== tid);
      guardar(CHAVE_NAO, t);
      pintaDesc();
    });
  },
  'desc-abrir': ({ b }) => {
    const tipo = V.UI.descTipo,
      x = descItem(tipo, b.closest('[data-tid]').dataset.tid);
    if (x) abrirDescDetalhe(x, tipo);
  },
  'desc-add': ({ b }) => adicionarDesc(descAberto ? descAberto.tipo : V.UI.descTipo, b.closest('[data-tid]').dataset.tid, b),
};
