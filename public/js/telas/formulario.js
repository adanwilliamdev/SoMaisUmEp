// Formulário de série/filme (novo ou editar), com busca no TMDb e capa.
import { $, html, raw, uid, aviso } from '../util.js';
import { tmdb } from '../api.js';
import { L, achar, save } from '../loja.js';
import { tp, vis, registrarProgresso, acharDuplicado } from '../regras.js';
import * as V from '../views.js';
import { enviarCapa } from '../capas.js';
import { dlg, ctx, gancho, onde } from './ctx.js';
import { pintaDetalhe, salvaAvaliacao } from './detalhe.js';

let novaCapa;

function formSerie(id, tipoNovo) {
  const s = id ? achar(id) : null;
  const tipo = s ? tp(s) : tipoNovo || 'tv',
    mv = tipo === 'movie';
  novaCapa = s ? s.capa : null;
  let meta = s ? { sinopse: s.sinopse, ano: s.ano, duracao: s.duracao, nota: s.nota, tmdb: s.tmdb, proximo: s.proximo || null } : {};
  ctx.aberta = null;
  dlg.innerHTML = html`<h2>${s ? 'Editar' : mv ? 'Novo' : 'Nova'} ${mv ? 'filme' : 'série'}</h2>
    <br />
    <form id="f" data-id="${s ? s.id : ''}">
      <label>Nome<input type="text" name="nome" required maxlength="80" value="${s ? s.nome : ''}" /></label>
      <label
        >Buscar no TMDb (opcional)<span class="linha-busca"
          ><input type="text" id="tq" placeholder="${mv ? 'Nome do filme' : 'Nome da série'}" /><button type="button" class="btn mini" id="tb">
            Buscar
          </button></span
        ></label
      >
      <div id="res" class="res"></div>
      <div id="dup"></div>
      <div id="blocotemp" ${mv ? 'hidden' : ''}>
        <label>Número de temporadas<input type="number" name="nt" min="1" max="30" value="${s ? s.eps.length : 1}" /></label>
        <div class="rotulo-eps">Episódios por temporada</div>
        <div class="eps-inputs" id="temps"></div>
        <br />
      </div>
      <label>Capa (opcional)<input type="file" accept="image/*" name="capa" /></label>
      <div id="previa"></div>
      <div class="rodape-dlg">
        <button type="button" class="btn sec" data-act="${s ? 'abrir' : 'fechar'}">Cancelar</button><button class="btn" type="submit">Salvar</button>
      </div>
    </form>`;
  const f = $('#f');
  let salvando = false;

  // Avisa (sem bloquear a tela) quando o título já está na estante; o botão leva até ele.
  const avisoDup = cand => {
    const d = acharDuplicado(L.series, cand, s && s.id);
    $('#dup').innerHTML = d
      ? html`<p class="aviso">
          ⚠️ <b>${d.nome}</b>${d.ano ? ' (' + d.ano + ')' : ''} já está na sua estante.
          <button type="button" class="btn mini sec" data-act="abrir" data-id="${d.id}">Abrir o existente</button>
        </p>`
      : '';
    return d;
  };
  const desenha = arr => {
    const n = Math.max(1, Math.min(30, +f.nt.value || 1));
    const atual = [...document.querySelectorAll('#temps input')].map(i => +i.value);
    $('#temps').innerHTML = html`${Array.from(
      { length: n },
      (_, i) => html`<label>T${i + 1}<input type="number" min="1" max="999" value="${(arr && arr[i]) || atual[i] || (s && s.eps[i]) || 10}" /></label>`,
    )}`;
  };
  const previa = () => {
    $('#previa').innerHTML = novaCapa
      ? html`<div class="previa-cab">
          <div class="previa-img"><img src="${novaCapa}" alt="" /></div>
          <button type="button" class="btn sec mini" data-act="semcapa">Remover capa</button>
        </div>`
      : '';
  };
  desenha();
  previa();
  f.nt.addEventListener('input', () => desenha());
  f.nome.addEventListener('input', () => avisoDup({ tipo, nome: f.nome.value, ano: meta.ano, tmdb: meta.tmdb }));

  const busca = async () => {
    const q = $('#tq').value.trim(),
      res = $('#res');
    if (!q) return;
    res.innerHTML = raw('<p class="aviso">Buscando…</p>');
    try {
      const R = (await tmdb({ acao: 'busca', tipo, q })).resultados;
      res.innerHTML = R.length
        ? html`${R.map(
            x =>
              html`<button type="button" class="r" data-tid="${x.id}">
                <div class="p">${x.poster ? html`<img src="${x.poster}" alt="" />` : ''}</div>
                <span><b>${x.nome}</b><small>${x.ano}</small></span>
              </button>`,
          )}`
        : raw('<p class="aviso">Nada encontrado.</p>');
    } catch (e) {
      res.innerHTML = html`<p class="aviso">${e.auth ? 'Sessão expirada. Recarregue a página.' : e.message}</p>`;
    }
  };
  $('#tb').addEventListener('click', busca);
  $('#tq').addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      ev.stopPropagation();
      busca();
    }
  });
  $('#res').addEventListener('click', async ev => {
    const b = ev.target.closest('[data-tid]');
    if (!b) return;
    b.disabled = true;
    try {
      const d = await tmdb({ acao: 'detalhe', tipo, id: b.dataset.tid });
      f.nome.value = d.nome;
      if (!mv) {
        if (!d.eps.length) throw new Error('Esta série não tem temporadas no TMDb.');
        f.nt.value = d.eps.length;
        desenha(d.eps);
      }
      if (d.poster) novaCapa = d.poster;
      previa();
      meta = { sinopse: d.sinopse, ano: d.ano, duracao: d.duracao, nota: d.nota, tmdb: d.tmdb, proximo: d.proximo || null };
      $('#res').innerHTML = raw('<p class="aviso">Dados preenchidos ✓ Confira e salve.</p>');
      avisoDup({ tipo, nome: d.nome, ano: d.ano, tmdb: d.tmdb });
    } catch (e) {
      $('#res').innerHTML = html`<p class="aviso">${e.auth ? 'Sessão expirada. Recarregue a página.' : e.message}</p>`;
    }
  });
  f.capa.addEventListener('change', () => {
    const file = f.capa.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const W = 240,
          H = 360,
          c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const k = Math.max(W / im.width, H / im.height),
          w = im.width * k,
          h = im.height * k;
        c.getContext('2d').drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
        novaCapa = c.toDataURL('image/jpeg', 0.7);
        previa();
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  });
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const eps = mv ? [1] : [...document.querySelectorAll('#temps input')].map(i => Math.max(1, Math.min(999, +i.value || 1)));
    const nome = f.nome.value.trim();
    if (!nome || salvando) return;
    if (avisoDup({ tipo, nome, ano: meta.ano, tmdb: meta.tmdb })) {
      aviso('Esse título já está na sua estante.');
      return;
    }
    salvando = true;
    const ok = f.querySelector('[type=submit]');
    ok.disabled = true;
    const capaFinal = novaCapa && novaCapa.startsWith('data:') ? await enviarCapa(novaCapa) : novaCapa; // Blob, se configurado
    const sid = f.dataset.id,
      ex = sid ? achar(sid) : null;
    if (ex) {
      const antes = vis(ex);
      Object.assign(ex, meta);
      ex.nome = nome;
      ex.capa = capaFinal;
      ex.vis = eps.map((n, i) => Math.min(ex.vis[i] || 0, n));
      ex.eps = eps;
      registrarProgresso(ex, antes);
      delete onde[ex.id];
      ctx.aberta = ex.id;
    } else {
      L.series.unshift({ ...meta, tipo, id: uid(), criado: Date.now(), nome, capa: capaFinal, eps, vis: eps.map(() => 0) });
      ctx.aberta = null;
      V.UI.filtro = 'todas';
      V.UI.busca = '';
    }
    save();
    gancho.render();
    if (ctx.aberta) pintaDetalhe();
    else dlg.close();
  });
  if (!dlg.open) dlg.showModal();
  f.nome.focus();
}

export const acoes = {
  nova: ({ b }) => formSerie(null, b.dataset.tipo),
  editar: ({ s }) => {
    if (!s) return;
    salvaAvaliacao();
    formSerie(s.id);
  },
  semcapa: ({ b }) => {
    novaCapa = null;
    b.closest('#previa').innerHTML = '';
  },
};
