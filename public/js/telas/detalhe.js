// Painel de detalhes de um título: onde assistir, avaliação pessoal, atualizar pelo TMDb e excluir.
import { $, aviso, confirma } from '../util.js';
import { L, achar, save } from '../loja.js';
import * as V from '../views.js';
import { atualizarDoTmdb, ondeAssistir } from '../tmdbsync.js';
import { dlg, ctx, gancho, onde, revela } from './ctx.js';
import { patchCard, renderLista } from './estante.js';

export function pintaDetalhe() {
  const s = achar(ctx.aberta);
  if (!s) {
    dlg.close();
    return;
  }
  const y = dlg.scrollTop;
  dlg.innerHTML = V.htmlDetalhe(s, onde[s.id] === undefined ? (s.tmdb ? 'carregando' : null) : onde[s.id]);
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = y;
  revela();
  carregaOnde(s);
}

function pintaOnde(s) {
  const el = $('#onde');
  if (el && ctx.aberta === s.id) el.innerHTML = V.htmlOnde(onde[s.id]);
}

async function carregaOnde(s) {
  if (onde[s.id] !== undefined) return;
  if (!s.tmdb) {
    onde[s.id] = null;
    return;
  }
  onde[s.id] = 'carregando';
  try {
    onde[s.id] = await ondeAssistir(s);
  } catch {
    onde[s.id] = 'erro';
  }
  pintaOnde(s);
}

// Nota (0 a 10, de meio em meio ponto) e resenha pessoais.
export function salvaAvaliacao() {
  const s = achar(ctx.aberta),
    n = $('#mnota'),
    r = $('#mres');
  if (!s || !n || !r) return;
  const v = n.value.trim().replace(',', '.'),
    nota = v === '' || !Number.isFinite(+v) ? null : Math.max(0, Math.min(10, Math.round(+v * 2) / 2));
  const res = r.value.trim() || null;
  if (nota === (s.nota_pessoal ?? null) && res === (s.resenha ?? null)) return;
  s.nota_pessoal = nota;
  s.resenha = res;
  n.value = nota == null ? '' : nota;
  save();
  patchCard(s.id, false);
}

dlg.addEventListener('change', e => {
  if (e.target.id === 'mnota' || e.target.id === 'mres') salvaAvaliacao();
  if (e.target.id === 'msit') {
    const s = achar(ctx.aberta);
    if (!s) return;
    s.situacao = e.target.value === 'pausada' || e.target.value === 'abandonada' ? e.target.value : null;
    save();
    gancho.render(); // a estante muda de grupo (e os filtros podem mudar)
    pintaDetalhe();
  }
});
dlg.addEventListener('close', () => {
  salvaAvaliacao();
  ctx.aberta = null;
  for (const k in onde) if (onde[k] === 'erro') delete onde[k];
});

export const acoes = {
  abrir: ({ id, b }) => {
    ctx.aberta = id || ctx.aberta || (b.closest('form') || {}).dataset?.id;
    if (ctx.aberta) pintaDetalhe();
  },
  'atualizar-tmdb': async ({ b, s }) => {
    if (!s) return;
    const orig = b.textContent;
    b.disabled = true;
    b.textContent = 'Atualizando…';
    try {
      const r = await atualizarDoTmdb(s);
      if (r.erro) aviso(r.erro);
      else if (r.mudou.length) {
        aviso(r.voltouAssistir ? 'Há episódios novos! Progresso mantido.' : `Atualizado: ${r.mudou.join(', ')}.`);
        renderLista();
        if (ctx.aberta === s.id) pintaDetalhe();
      } else aviso('Já está em dia com o TMDb.');
    } catch (err) {
      aviso(err.rede ? 'Sem conexão com o TMDb.' : err.message);
    }
    if (b.isConnected) {
      b.disabled = false;
      b.textContent = orig;
    }
  },
  del: ({ b, s }) => {
    if (!s) return;
    confirma(b, () => {
      L.series = L.series.filter(x => x.id !== s.id);
      L.tops.forEach(top =>
        top.itens.forEach(it => {
          if (it.sid === s.id) delete it.sid;
        }),
      );
      delete onde[s.id];
      save();
      dlg.close();
      gancho.render();
    });
  },
};
