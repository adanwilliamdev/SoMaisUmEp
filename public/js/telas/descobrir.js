// Descobrir: "em alta" e "parecidos" do TMDb, detalhe de um título do TMDb e adicionar à estante.
import { $, uid, aviso, avisoDesfazer } from '../util.js';
import { L, save } from '../loja.js';
import { acharDuplicado, sementes } from '../regras.js';
import * as V from '../views.js';
import { ondeAssistir, emAlta, parecidos, detalheTmdb } from '../tmdbsync.js';
import { dlg, ctx, gancho, onde, aba, revela } from './ctx.js';

const desc = { tv: null, movie: null }; // por tipo: { alta, parecidos } (lista, 'carregando', 'erro' ou null); guardado só durante a sessão
let descAberto = null; // { x, tipo }: título do TMDb aberto no painel

export const limparDescobrir = () => {
  desc.tv = desc.movie = null;
};

export const descDados = () => desc[V.UI.descTipo] || { alta: 'carregando', parecidos: sementes(L.series, V.UI.descTipo).length ? 'carregando' : null };

const descItem = (tipo, tid) => {
  const d = desc[tipo] || {};
  for (const l of [d.parecidos, d.alta])
    if (Array.isArray(l)) {
      const x = l.find(y => String(y.id) === String(tid));
      if (x) return x;
    }
  return null;
};

export function pintaDesc() {
  if (aba() === '#descobrir' && $('#desc')) {
    $('#desc').innerHTML = V.htmlDescobrir(V.UI.descTipo, descDados());
    revela();
  }
}

export async function carregaDescobrir(tipo) {
  if (desc[tipo]) return;
  const sem = sementes(L.series, tipo).map(s => s.tmdb);
  const d = (desc[tipo] = { alta: 'carregando', parecidos: sem.length ? 'carregando' : null });
  const pega = (campo, p) =>
    p
      .then(
        r => {
          d[campo] = r;
        },
        e => {
          d[campo] = 'erro';
          if (e.auth) gancho.telaAuth('entrar');
        },
      )
      .then(pintaDesc);
  await Promise.all([pega('alta', emAlta(tipo)), sem.length ? pega('parecidos', parecidos(tipo, sem)) : null]);
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
    desc[V.UI.descTipo] = null;
    gancho.render();
  },
  'desc-abrir': ({ b }) => {
    const tipo = V.UI.descTipo,
      x = descItem(tipo, b.closest('[data-tid]').dataset.tid);
    if (x) abrirDescDetalhe(x, tipo);
  },
  'desc-add': ({ b }) => adicionarDesc(descAberto ? descAberto.tipo : V.UI.descTipo, b.closest('[data-tid]').dataset.tid, b),
};
