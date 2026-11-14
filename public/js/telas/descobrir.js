// Descobrir: radar de afinidade pessoal (cruza só com o seu histórico), detalhe de um título do TMDb e adicionar à estante.
import { $, uid, aviso, avisoDesfazer, guardar, lerJSON } from '../util.js';
import { L, save } from '../loja.js';
import { acharDuplicado, sementesRadar, idsRadar } from '../regras.js';
import * as V from '../views.js';
import { ondeAssistir, radar, detalheTmdb } from '../tmdbsync.js';
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

// A chave muda quando as sementes mudam (você concluiu ou avaliou algo): aí o radar é refeito.
const chaveRadar = tipo => idsRadar(sementesRadar(L.series, tipo)).join(',');

export const descDados = () => {
  const tipo = V.UI.descTipo,
    d = desc[tipo],
    nao = dispensados(tipo);
  if (d && d.chave === chaveRadar(tipo)) return { ...d, dispensados: nao };
  return { radar: chaveRadar(tipo) ? 'carregando' : null, dispensados: nao };
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
  const chave = chaveRadar(tipo);
  const atual = desc[tipo];
  if (atual && atual.chave === chave && Date.now() - (atual.quando || 0) < VALIDADE && atual.radar !== 'erro') return;
  if (!chave) {
    desc[tipo] = { chave, radar: null };
    return;
  }
  const d = (desc[tipo] = { chave, radar: 'carregando' });
  try {
    d.radar = await radar(tipo, chave.split(','), forcar[tipo]);
    d.quando = Date.now();
  } catch (e) {
    d.radar = 'erro';
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

export const acoes = {
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
