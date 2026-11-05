// Importar de outro app (Letterboxd, IMDb, Trakt): ler arquivos, buscar no TMDb em lotes, desfazer.
import { $, uid, aviso } from '../util.js';
import { api } from '../api.js';
import { L, save } from '../loja.js';
import { acharDuplicado } from '../regras.js';
import * as V from '../views.js';
import { lerZip, lerArquivo, consolidar, resumoImportacao, montarTitulo, limitarImportacao, MAX_IMPORTACAO } from '../importacao.js';
import { dlg, ctx, gancho } from './ctx.js';

let imp = null; // { entradas, fontes, parar, ids, rodando }

function abrirImportar() {
  ctx.aberta = null;
  imp = null;
  dlg.innerHTML = V.htmlImportar();
  if (!dlg.open) dlg.showModal();
}

dlg.addEventListener('close', () => {
  if (imp && !imp.rodando) imp = null;
});
dlg.addEventListener('change', e => {
  if (e.target.id === 'imparq' && e.target.files.length) lerArquivosImportacao([...e.target.files]);
});

async function lerArquivosImportacao(arquivos) {
  const msg = $('#imp-msg');
  msg.textContent = 'Lendo os arquivos…';
  const todas = [],
    fontes = new Set();
  try {
    for (const f of arquivos) {
      if (f.size > 60e6) throw new Error(`${f.name} é grande demais (máximo 60 MB).`);
      const itens = /\.zip$/i.test(f.name) ? await lerZip(await f.arrayBuffer(), n => /\.csv$/i.test(n)) : [{ nome: f.name, texto: await f.text() }];
      for (const it of itens) {
        const r = lerArquivo(it.nome, it.texto);
        if (r) {
          todas.push(...r.entradas);
          fontes.add(r.fonte);
        }
      }
    }
  } catch (e) {
    msg.textContent = e.message;
    return;
  }
  const jaTem = e => !!acharDuplicado(L.series, { tipo: e.tipo, nome: e.nome, ano: e.ano ? String(e.ano) : null, tmdb: e.tmdb ? Number(e.tmdb) : null });
  const { entradas, cortadas } = limitarImportacao(consolidar(todas), jaTem);
  if (cortadas)
    aviso(
      `Importando os primeiros ${MAX_IMPORTACAO} títulos. Sobraram ${cortadas}: depois de terminar, importe os mesmos arquivos de novo para trazer o resto.`,
      12000,
    );
  if (!entradas.length) {
    msg.textContent = 'Não encontrei títulos nesses arquivos. Confira se são exports do Letterboxd, IMDb ou Trakt (veja as dicas acima).';
    return;
  }
  imp = { entradas, fontes: [...fontes], parar: false, ids: [], rodando: false };
  dlg.innerHTML = V.htmlImportar({ previa: resumoImportacao(entradas), fontes: imp.fontes });
}

async function iniciarImportacao() {
  const total = imp.entradas.length,
    t0 = Date.now(),
    naoAchou = [];
  let feitos = 0,
    repetidos = 0,
    parou = false;
  const andamento = () => {
    const pct = Math.round((feitos / total) * 100);
    dlg.innerHTML = V.htmlImportar({ andamento: { pct, texto: `Buscando no TMDb… ${feitos} de ${total}` } });
  };
  imp.rodando = true;
  imp.parar = false;
  imp.ids = [];
  andamento();
  const barra = () => dlg.querySelector('.imp-barra');
  try {
    for (let i = 0; i < total; i += 10) {
      if (imp.parar) {
        parou = true;
        break;
      }
      const lote = imp.entradas.slice(i, i + 10),
        novos = [];
      const r = (
        await api('/api/tmdb', { method: 'POST', body: { itens: lote.map(e => ({ tipo: e.tipo, nome: e.nome, ano: e.ano, tmdb: e.tmdb, imdb: e.imdb })) } })
      ).resultados;
      lote.forEach((e, k) => {
        const info = r[k],
          rot = e.nome + (e.ano ? ` (${e.ano})` : '');
        if (!info || !info.ok) {
          naoAchou.push(rot);
          return;
        }
        if (e.tipo === 'tv' && !info.eps.length) {
          naoAchou.push(rot + ' · sem temporadas no TMDb');
          return;
        }
        const cand = { tipo: e.tipo, nome: info.nome, ano: info.ano, tmdb: info.tmdb };
        if (acharDuplicado(L.series, cand) || acharDuplicado(novos, cand)) {
          repetidos++;
          return;
        }
        novos.push(montarTitulo(e, info, { id: uid(), criado: t0 - (i + k) }));
      });
      if (novos.length) {
        L.series.unshift(...novos);
        imp.ids.push(...novos.map(x => x.id));
        save();
      }
      feitos += lote.length;
      const pct = Math.round((feitos / total) * 100),
        b = barra();
      if (b) {
        b.setAttribute('aria-valuenow', pct);
        b.firstElementChild.style.width = pct + '%';
      }
      const tx = $('#imp-txt');
      if (tx) tx.textContent = `Buscando no TMDb… ${feitos} de ${total}`;
    }
  } catch (e) {
    if (e.auth) {
      imp.rodando = false;
      gancho.telaAuth('entrar');
      return;
    }
    aviso(e.rede ? 'Sem conexão. A importação parou; o que já entrou foi mantido.' : e.message);
    parou = true;
  }
  imp.rodando = false;
  V.UI.filtro = 'todas';
  V.UI.busca = '';
  dlg.innerHTML = V.htmlImportar({ fim: { novos: imp.ids.length, repetidos, naoAchou, parou } });
  if (imp.ids.length)
    dlg
      .querySelector('.rodape-dlg')
      .insertAdjacentHTML('afterbegin', '<button class="btn sec perigo" data-act="importar-desfazer">Desfazer importação</button>');
  gancho.render();
}

function desfazerImportacao() {
  const ids = new Set(imp.ids);
  L.series = L.series.filter(s => !ids.has(s.id));
  save();
  imp = null;
  dlg.close();
  gancho.render();
  aviso('Importação desfeita.');
}

export const acoes = {
  'importar-abrir': abrirImportar,
  'importar-iniciar': () => {
    if (imp) iniciarImportacao();
  },
  'importar-parar': ({ b }) => {
    if (!imp) return;
    imp.parar = true;
    b.disabled = true;
    b.textContent = 'Parando…';
  },
  'importar-desfazer': () => {
    if (imp) desfazerImportacao();
  },
};
