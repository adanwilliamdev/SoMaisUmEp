const $ = s => document.querySelector(s);
const app = $('#app'),
  dlg = $('#dlg');
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => crypto.randomUUID();

let S = { series: [], tops: [] },
  filtro = 'todas',
  aberta = null,
  novaCapa;
let logado = false,
  remoto = {},
  fila = Promise.resolve(),
  pendentes = 0,
  animar = true;

/* ---------- servidor ---------- */
async function api(url, opt = {}) {
  const r = await fetch(url, {
    credentials: 'same-origin',
    method: opt.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  if (r.status === 401) throw Object.assign(new Error('Não autorizado'), { auth: true });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status);
  return j;
}
const chaves = () => {
  const o = {};
  S.series.forEach(s => (o['T' + s.id] = JSON.stringify(s)));
  S.tops.forEach(t => (o['P' + t.id] = JSON.stringify(t)));
  return o;
};
function status(t, erro) {
  const el = $('#status');
  if (el) {
    el.textContent = t;
    el.style.color = erro ? '#e5484d' : '';
  }
}

// Chamado após qualquer alteração: envia ao banco só o que mudou, em fila.
function save() {
  pendentes++;
  status('Salvando…');
  fila = fila.then(sync);
}
async function sync() {
  try {
    const atual = chaves(),
      T = [],
      P = [],
      del = { titulos: [], tops: [] };
    for (const k in atual) if (atual[k] !== remoto[k]) (k[0] === 'T' ? T : P).push(JSON.parse(atual[k]));
    for (const k in remoto) if (!(k in atual)) del[k[0] === 'T' ? 'titulos' : 'tops'].push(k.slice(1));
    const reqs = [];
    for (let i = 0; i < T.length; i += 15) reqs.push({ titulos: T.slice(i, i + 15) });
    if (P.length) reqs.push({ tops: P });
    if (del.titulos.length || del.tops.length) reqs.push({ del });
    for (const body of reqs) await api('/api/sync', { method: 'POST', body });
    remoto = atual;
    pendentes--;
    if (!pendentes) status('Salvo ✓');
  } catch (e) {
    pendentes--;
    if (e.auth) return telaLogin();
    status('Erro ao salvar: ' + e.message + '. Será reenviado na próxima alteração.', true);
  }
}
addEventListener('beforeunload', e => {
  if (pendentes > 0) e.preventDefault();
});

function esqueleto() {
  const caixa = n =>
    Array.from({ length: n }, () => '<div><div class="sk sk-capa"></div><div class="sk sk-l1"></div><div class="sk sk-l2"></div></div>').join('');
  const corpo =
    location.hash === '#tops'
      ? '<div class="tops"><div class="sk sk-top"></div><div class="sk sk-top"></div></div>'
      : `<div class="stats"><div class="sk sk-stat"></div><div class="sk sk-stat"></div><div class="sk sk-stat"></div></div><div class="grade">${caixa(8)}</div>`;
  return `<div aria-busy="true"><span class="sr" role="status">Carregando…</span><div class="sk sk-h1"></div><div class="sk sk-sub"></div>${corpo}</div>`;
}
async function iniciar() {
  app.innerHTML = esqueleto();
  try {
    const d = await api('/api/dados');
    S = { series: d.series || [], tops: d.tops || [] };
    remoto = chaves();
    logado = true;
    animar = true;
    status('Salvo ✓');
    render();
  } catch (e) {
    if (e.auth) telaLogin();
    else
      app.innerHTML = `<div class="vazio">Não foi possível carregar seus dados: ${esc(e.message)}<br><small>Se persistir, confira as variáveis de ambiente e o banco (veja o README, "Se aparecer erro no servidor").</small><br><br><button class="btn mini" data-act="recarregar">Tentar de novo</button></div>`;
  }
}
function telaLogin() {
  logado = false;
  if (dlg.open) dlg.close();
  app.innerHTML = `<h1>Entrar</h1><p class="sub">Digite a senha para acessar sua estante.</p>
    <div class="nova-top"><input type="password" id="senha" placeholder="Senha" autocomplete="current-password" aria-label="Senha"><button class="btn" data-act="entrar">Entrar</button></div>
    <p class="aviso" id="msg" role="alert"></p>`;
  $('#senha').focus();
}
async function entrar() {
  const m = $('#msg');
  m.textContent = '';
  try {
    await api('/api/login', { method: 'POST', body: { senha: $('#senha').value } });
    iniciar();
  } catch (e) {
    m.textContent = e.auth ? 'Senha incorreta.' : e.message;
  }
}

/* ---------- helpers ---------- */
const hue = n => [...String(n)].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) % 360;
const tot = s => s.eps.reduce((a, b) => a + b, 0);
const vis = s => s.vis.reduce((a, b) => a + b, 0);
const estado = s => {
  const v = vis(s);
  return v === 0 ? 'quero' : v >= tot(s) ? 'fim' : 'assistindo';
};
const prox = s => {
  for (let i = 0; i < s.eps.length; i++) if (s.vis[i] < s.eps[i]) return [i + 1, s.vis[i] + 1];
  return null;
};
const capa = (nome, img, urgente) =>
  img
    ? `<img class="fade" src="${esc(img)}" alt="" decoding="async" ${urgente ? 'fetchpriority="high"' : 'loading="lazy"'}>`
    : `<div class="ph" style="--h:${hue(nome)}"><span>${esc((String(nome).trim()[0] || '?').toUpperCase())}</span></div>`;
const rotulo = s => {
  const p = prox(s),
    e = estado(s);
  if (tp(s) === 'movie') return e === 'fim' ? 'Assistido ✓' : 'Na fila';
  return e === 'fim' ? 'Concluída ✓' : e === 'quero' ? 'Na fila' : `Próximo: T${p[0]} · E${p[1]}`;
};
const achar = id => S.series.find(s => s.id === id);
const tp = s => s.tipo || 'tv';

/* ---------- lista (séries / filmes) ---------- */
function viewLista(tipo) {
  const mv = tipo === 'movie',
    L = S.series.filter(s => tp(s) === tipo);
  const fs = mv
    ? [
        ['todas', 'Todos'],
        ['quero', 'Na fila'],
        ['fim', 'Assistidos'],
      ]
    : [
        ['todas', 'Todas'],
        ['assistindo', 'Assistindo'],
        ['quero', 'Na fila'],
        ['fim', 'Concluídas'],
      ];
  if (!fs.some(([k]) => k === filtro)) filtro = 'todas';
  const lista = L.filter(s => filtro === 'todas' || estado(s) === filtro);
  const fim = L.filter(s => estado(s) === 'fim').length,
    eps = L.reduce((a, s) => a + vis(s), 0);
  const chips = fs.map(([k, r]) => `<button class="chip" data-act="filtro" data-k="${k}" aria-pressed="${filtro === k}">${r}</button>`).join('');
  const cards = lista
    .map((s, n) => {
      const pct = Math.round((vis(s) / tot(s)) * 100),
        p = prox(s);
      return `<article class="card" data-id="${s.id}" style="--i:${Math.min(n, 14)}">
      <button class="capa" data-act="abrir" aria-label="Abrir ${esc(s.nome)}">${capa(s.nome, s.capa)}
        ${mv ? '' : `<span class="sel">${pct}%</span>`}<span class="prog"><i style="width:${pct}%;display:block;height:100%"></i></span></button>
      <h3>${esc(s.nome)}</h3><small>${rotulo(s)}${mv && s.ano ? ' · ' + esc(s.ano) : ''}</small>
      ${p ? `<button class="btn sec mini mais" data-act="mais">${mv ? 'Marcar como visto' : '+1 episódio'}</button>` : ''}
    </article>`;
    })
    .join('');
  const stats = mv
    ? [
        [L.length, 'filmes'],
        [fim, 'assistidos'],
        [L.length - fim, 'na fila'],
      ]
    : [
        [L.length, 'séries'],
        [eps, 'episódios vistos'],
        [fim, 'concluídas'],
      ];
  return `<h1>${mv ? 'Meus filmes' : 'Minhas séries'}</h1>
    <p class="sub">${mv ? 'Registre o que você já viu e o que quer ver.' : 'Acompanhe cada temporada e episódio.'}</p>
    <div class="stats">${stats.map(([n, r]) => `<div class="stat"><b>${n}</b><span>${r}</span></div>`).join('')}</div>
    <div class="barra-acoes">${chips}<span class="esp"></span><button class="btn" data-act="nova" data-tipo="${tipo}">${mv ? '+ Novo filme' : '+ Nova série'}</button></div>
    ${
      lista.length
        ? `<div class="grade">${cards}</div>`
        : `<div class="vazio">${L.length ? 'Nada neste filtro.' : mv ? 'Nenhum filme ainda. Adicione o primeiro.' : 'Sua estante está vazia. Adicione a primeira série para começar.'}</div>`
    }`;
}

function pintaDetalhe() {
  const s = achar(aberta);
  if (!s) {
    dlg.close();
    return;
  }
  const pct = Math.round((vis(s) / tot(s)) * 100);
  const mv = tp(s) === 'movie';
  const temps = mv
    ? `<div class="temp"><button class="btn${vis(s) ? ' sec' : ''}" data-act="visto">${vis(s) ? 'Desmarcar como visto' : 'Marcar como visto'}</button></div>`
    : s.eps
        .map((n, i) => {
          let chips = '';
          for (let e = 1; e <= n; e++)
            chips += `<button class="ep" data-act="ep" data-s="${i}" data-e="${e}" aria-pressed="${s.vis[i] >= e}" aria-label="Episódio ${e}">${e}</button>`;
          return `<div class="temp"><div class="temp-cab"><b>Temporada ${i + 1} <span style="color:var(--mut);font-weight:400">· ${s.vis[i]}/${n}</span></b>
      <button class="btn sec mini" data-act="temp-tudo" data-s="${i}">Marcar toda</button>
      <button class="btn sec mini" data-act="temp-zero" data-s="${i}">Zerar</button></div><div class="eps">${chips}</div></div>`;
        })
        .join('');
  dlg.innerHTML = `<div data-id="${s.id}">
    <div class="cab"><div class="mini-capa">${capa(s.nome, s.capa, true)}</div>
      <div style="flex:1"><h2>${esc(s.nome)}</h2><div class="barra"><i style="width:${pct}%"></i></div>
      <small style="color:var(--mut)">${[s.ano, s.nota ? '★ ' + s.nota : ''].filter(Boolean).join(' · ')}${s.ano || s.nota ? '<br>' : ''}${mv ? (s.duracao ? s.duracao + ' min · ' : '') + rotulo(s) : vis(s) + ' de ' + tot(s) + ' episódios · ' + rotulo(s)}</small></div></div>
    ${s.sinopse ? `<p class="sin">${esc(s.sinopse)}</p>` : ''}
    ${temps}
    <div class="rodape-dlg">
      <button class="btn sec perigo mini" data-act="del">Excluir série</button>
      <button class="btn sec" data-act="editar">Editar</button>
      <button class="btn" data-act="fechar">Fechar</button></div></div>`;
  if (!dlg.open) dlg.showModal();
  revela();
}

function formSerie(id, tipoNovo) {
  const s = id ? achar(id) : null;
  const tipo = s ? tp(s) : tipoNovo || 'tv',
    mv = tipo === 'movie';
  novaCapa = s ? s.capa : null;
  let meta = s ? { sinopse: s.sinopse, ano: s.ano, duracao: s.duracao, nota: s.nota, tmdb: s.tmdb } : {};
  aberta = null;
  dlg.innerHTML = `<h2>${s ? 'Editar' : mv ? 'Novo' : 'Nova'} ${mv ? 'filme' : 'série'}</h2><br>
    <form id="f" data-id="${s ? s.id : ''}">
      <label>Nome<input type="text" name="nome" required maxlength="80" value="${s ? esc(s.nome) : ''}"></label>
      <label>Buscar no TMDb (opcional)<span style="display:flex;gap:8px"><input type="text" id="tq" placeholder="${mv ? 'Nome do filme' : 'Nome da série'}"><button type="button" class="btn mini" id="tb">Buscar</button></span></label>
      <div id="res" class="res"></div>
      <div id="blocotemp" ${mv ? 'hidden' : ''}><label>Número de temporadas<input type="number" name="nt" min="1" max="30" value="${s ? s.eps.length : 1}"></label>
      <div style="font-size:.82rem;font-weight:600;color:var(--mut);margin-bottom:6px">Episódios por temporada</div>
      <div class="eps-inputs" id="temps"></div><br></div>
      <label>Capa (opcional)<input type="file" accept="image/*" name="capa"></label>
      <div id="previa"></div>
      <div class="rodape-dlg"><button type="button" class="btn sec" data-act="${s ? 'abrir' : 'fechar'}">Cancelar</button><button class="btn" type="submit">Salvar</button></div>
    </form>`;
  const f = $('#f');
  const desenha = arr => {
    const n = Math.max(1, Math.min(30, +f.nt.value || 1));
    const atual = [...document.querySelectorAll('#temps input')].map(i => +i.value);
    $('#temps').innerHTML = Array.from(
      { length: n },
      (_, i) => `<label>T${i + 1}<input type="number" min="1" max="999" value="${(arr && arr[i]) || atual[i] || (s && s.eps[i]) || 10}"></label>`,
    ).join('');
  };
  const previa = () => {
    $('#previa').innerHTML = novaCapa
      ? `<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px"><div style="width:56px;aspect-ratio:2/3;border-radius:6px;overflow:hidden"><img src="${esc(novaCapa)}" alt="" style="width:100%;height:100%;object-fit:cover"></div><button type="button" class="btn sec mini" data-act="semcapa">Remover capa</button></div>`
      : '';
  };
  desenha();
  previa();
  f.nt.addEventListener('input', () => desenha());
  const busca = async () => {
    const q = $('#tq').value.trim(),
      res = $('#res');
    if (!q) return;
    res.innerHTML = '<p class="aviso">Buscando…</p>';
    try {
      const L = (await tmdb({ acao: 'busca', tipo, q })).resultados;
      res.innerHTML = L.length
        ? L.map(
            x =>
              `<button type="button" class="r" data-tid="${x.id}"><div class="p">${x.poster ? `<img src="${esc(x.poster)}" alt="">` : ''}</div><span><b>${esc(x.nome)}</b><small>${esc(x.ano)}</small></span></button>`,
          ).join('')
        : '<p class="aviso">Nada encontrado.</p>';
    } catch (e) {
      res.innerHTML = `<p class="aviso">${esc(e.auth ? 'Sessão expirada. Recarregue a página.' : e.message)}</p>`;
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
      meta = { sinopse: d.sinopse, ano: d.ano, duracao: d.duracao, nota: d.nota, tmdb: d.tmdb };
      $('#res').innerHTML = '<p class="aviso">Dados preenchidos ✓ Confira e salve.</p>';
    } catch (e) {
      $('#res').innerHTML = `<p class="aviso">${esc(e.auth ? 'Sessão expirada. Recarregue a página.' : e.message)}</p>`;
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
  f.addEventListener('submit', ev => {
    ev.preventDefault();
    const eps = mv ? [1] : [...document.querySelectorAll('#temps input')].map(i => Math.max(1, Math.min(999, +i.value || 1)));
    const nome = f.nome.value.trim();
    if (!nome) return;
    const sid = f.dataset.id,
      ex = sid ? achar(sid) : null;
    if (ex) {
      Object.assign(ex, meta);
      ex.nome = nome;
      ex.capa = novaCapa;
      ex.vis = eps.map((n, i) => Math.min(ex.vis[i] || 0, n));
      ex.eps = eps;
      aberta = ex.id;
    } else {
      const n = { ...meta, tipo, id: uid(), criado: Date.now(), nome, capa: novaCapa, eps, vis: eps.map(() => 0) };
      S.series.unshift(n);
      aberta = null;
    }
    save();
    render();
    if (aberta) pintaDetalhe();
    else dlg.close();
  });
  if (!dlg.open) dlg.showModal();
  f.nome.focus();
}

/* ---------- tops ---------- */
function viewTops() {
  const dl = `<datalist id="nomes">${S.series.map(s => `<option value="${esc(s.nome)}"></option>`).join('')}</datalist>`;
  const cards = S.tops
    .map((t, n) => {
      const li = t.itens
        .map((it, i) => {
          const s = it.sid ? achar(it.sid) : null;
          return `<li data-i="${i}"><span class="n">${i + 1}</span><div class="p">${capa(it.t, s && s.capa)}</div><span class="t">${esc(it.t)}</span>
        <span class="mv"><button data-act="sobe" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button><button data-act="desce" aria-label="Descer" ${i === t.itens.length - 1 ? 'disabled' : ''}>↓</button><button data-act="tira" aria-label="Remover">✕</button></span></li>`;
        })
        .join('');
      return `<section class="top" data-top="${t.id}" style="--i:${Math.min(n, 8)}">
      <div class="top-cab"><h2>${esc(t.nome)}</h2><small>${t.itens.length}/10</small><button class="btn sec perigo mini" data-act="del-top">Excluir</button></div>
      ${li ? `<ol>${li}</ol>` : '<p style="color:var(--mut);font-size:.9rem">Lista vazia. Adicione seu primeiro título.</p>'}
      ${t.itens.length < 10 ? `<div class="add"><input type="text" list="nomes" maxlength="80" placeholder="Série ou filme" aria-label="Adicionar título"><button class="btn mini" data-act="add-item">Adicionar</button></div>` : ''}
    </section>`;
    })
    .join('');
  return `<h1>Meus tops 10</h1>
    <p class="sub">Monte rankings do seu jeito: melhores da década, finais favoritos, o que for.</p>
    <div class="nova-top"><input type="text" id="nt" maxlength="60" placeholder="Nome do top (ex.: Melhores séries de 2026)" aria-label="Nome do novo top"><button class="btn" data-act="novo-top">Criar</button></div>
    ${S.tops.length ? `<div class="tops">${cards}</div>` : '<div class="vazio">Nenhum top criado ainda.</div>'}${dl}`;
}

function addItem(tid) {
  const t = S.tops.find(x => x.id === tid),
    inp = document.querySelector(`[data-top="${tid}"] input`);
  const v = inp.value.trim();
  if (!v || t.itens.length >= 10) return;
  const m = S.series.find(s => s.nome.toLowerCase() === v.toLowerCase());
  t.itens.push(m ? { t: m.nome, sid: m.id } : { t: v });
  save();
  render();
  const novo = document.querySelector(`[data-top="${tid}"] .add input`);
  if (novo) novo.focus();
}

/* ---------- TMDb (via servidor) ---------- */
const tmdb = params => api('/api/tmdb?' + new URLSearchParams(params));

/* ---------- backup ---------- */
function backup() {
  aberta = null;
  dlg.innerHTML = `<h2>Backup</h2><p class="sub" style="margin-top:6px">Copie o texto abaixo para guardar seus dados. Para importar, cole um backup (inclusive o da versão antiga) e clique em Importar. Itens com o mesmo id são substituídos; os demais são mantidos.</p>
    <textarea id="bk" aria-label="Dados">${esc(JSON.stringify(S))}</textarea>
    <div class="rodape-dlg"><button class="btn sec" data-act="fechar">Fechar</button><button class="btn" data-act="importar">Importar</button></div>`;
  dlg.showModal();
  $('#bk').select();
}

/* ---------- render e eventos ---------- */
function render() {
  if (!logado) return;
  const h = location.hash,
    aba = h === '#tops' ? '#tops' : h === '#filmes' ? '#filmes' : '#series';
  document.querySelectorAll('.menu a').forEach(a => {
    if (a.getAttribute('href') === aba) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  app.classList.toggle('entra', animar);
  animar = false; // anima só ao trocar de aba/filtro, não a cada +1 episódio
  app.innerHTML = aba === '#tops' ? viewTops() : viewLista(aba === '#filmes' ? 'movie' : 'tv');
  revela();
}
addEventListener('hashchange', () => {
  animar = true;
  scrollTo({ top: 0, behavior: 'instant' });
  render();
});

// Imagens entram com fade quando terminam de carregar (load/error não borbulham: captura).
const mostra = e => {
  if (e.target.tagName === 'IMG') e.target.classList.add('ok');
};
document.addEventListener('load', mostra, true);
document.addEventListener('error', mostra, true);
const revela = () =>
  document.querySelectorAll('img.fade:not(.ok)').forEach(i => {
    if (i.complete && i.naturalWidth) i.classList.add('ok');
  });

function confirma(b, fn) {
  if (b.dataset.sure) {
    fn();
    return;
  }
  b.dataset.sure = 1;
  const orig = b.textContent;
  b.textContent = 'Confirmar?';
  setTimeout(() => {
    if (b.isConnected) {
      delete b.dataset.sure;
      b.textContent = orig;
    }
  }, 3000);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act,
    id = (b.closest('[data-id]') || {}).dataset?.id;
  const top = b.closest('[data-top]'),
    tid = top && top.dataset.top,
    li = b.closest('li'),
    i = li ? +li.dataset.i : -1;
  const s = id ? achar(id) : null,
    t = tid ? S.tops.find(x => x.id === tid) : null;
  if (a === 'filtro') {
    filtro = b.dataset.k;
    animar = true;
    render();
  } else if (a === 'nova') formSerie(null, b.dataset.tipo);
  else if (a === 'abrir') {
    aberta = id || aberta || (b.closest('form') || {}).dataset?.id;
    if (aberta) pintaDetalhe();
  } else if (a === 'fechar') {
    aberta = null;
    dlg.close();
  } else if (a === 'mais' && s) {
    const p = prox(s);
    if (p) {
      s.vis[p[0] - 1]++;
      save();
      render();
    }
  } else if (a === 'ep' && s) {
    const k = +b.dataset.s,
      n = +b.dataset.e;
    s.vis[k] = s.vis[k] === n ? n - 1 : n;
    save();
    render();
    pintaDetalhe();
  } else if (a === 'temp-tudo' && s) {
    const k = +b.dataset.s;
    s.vis[k] = s.eps[k];
    save();
    render();
    pintaDetalhe();
  } else if (a === 'temp-zero' && s) {
    s.vis[+b.dataset.s] = 0;
    save();
    render();
    pintaDetalhe();
  } else if (a === 'visto' && s) {
    s.vis[0] = s.vis[0] ? 0 : 1;
    save();
    render();
    pintaDetalhe();
  } else if (a === 'editar' && s) formSerie(s.id);
  else if (a === 'semcapa') {
    novaCapa = null;
    b.closest('#previa').innerHTML = '';
  } else if (a === 'del' && s)
    confirma(b, () => {
      S.series = S.series.filter(x => x.id !== s.id);
      S.tops.forEach(tp =>
        tp.itens.forEach(it => {
          if (it.sid === s.id) delete it.sid;
        }),
      );
      aberta = null;
      save();
      dlg.close();
      render();
    });
  else if (a === 'novo-top') {
    const v = $('#nt').value.trim();
    if (v) {
      S.tops.unshift({ id: uid(), criado: Date.now(), nome: v, itens: [] });
      save();
      render();
    }
  } else if (a === 'del-top' && t)
    confirma(b, () => {
      S.tops = S.tops.filter(x => x.id !== tid);
      save();
      render();
    });
  else if (a === 'add-item' && t) addItem(tid);
  else if (a === 'tira' && t) {
    t.itens.splice(i, 1);
    save();
    render();
  } else if ((a === 'sobe' || a === 'desce') && t) {
    const j = a === 'sobe' ? i - 1 : i + 1;
    if (j >= 0 && j < t.itens.length) {
      [t.itens[i], t.itens[j]] = [t.itens[j], t.itens[i]];
      save();
      render();
    }
  } else if (a === 'entrar') entrar();
  else if (a === 'recarregar') iniciar();
  else if (a === 'sair')
    api('/api/logout', { method: 'POST' })
      .catch(() => {})
      .then(() => {
        S = { series: [], tops: [] };
        telaLogin();
      });
  else if (a === 'backup') backup();
  else if (a === 'importar') {
    try {
      const j = JSON.parse($('#bk').value);
      if (!Array.isArray(j.series)) throw 0;
      const t0 = Date.now(),
        marca = (l, k) => (l || []).filter(x => x && x.id).map((x, i) => ({ criado: t0 - i, ...x }));
      const mescla = (novos, atuais) => {
        const ids = new Set(novos.map(x => x.id));
        return [...novos, ...atuais.filter(x => !ids.has(x.id))];
      };
      S = { series: mescla(marca(j.series), S.series), tops: mescla(marca(j.tops), S.tops) };
      save();
      dlg.close();
      render();
    } catch (err) {
      alert('Backup inválido.');
    }
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.matches('.add input')) {
    e.preventDefault();
    addItem(e.target.closest('[data-top]').dataset.top);
  } else if (e.target.id === 'senha') {
    e.preventDefault();
    entrar();
  } else if (e.target.id === 'nt') {
    e.preventDefault();
    document.querySelector('[data-act="novo-top"]').click();
  }
});
dlg.addEventListener('close', () => {
  aberta = null;
});

iniciar();
