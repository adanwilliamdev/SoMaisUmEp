// Estado dos dados + sincronização com o servidor:
//  - envia só o que mudou, em fila, com nova tentativa automática (espera crescente) quando a rede falha;
//  - guarda uma cópia no aparelho (abre sem internet e não perde alterações não enviadas);
//  - detecta edição simultânea em outro aparelho (campo `atualizado`) e combina as versões;
//  - recarrega os dados quando a aba volta ao foco.
import { api } from './api.js';
import { mesclarTitulo } from './regras.js';
import { status, aviso, faixa, guardar, lerJSON, apagar } from './util.js';

export const L = { series: [], tops: [], usuario: null, blob: false };
export const achar = id => L.series.find(s => s.id === id);

const hooks = { render() {}, login() {} };
export const ligar = h => Object.assign(hooks, h);

let remoto = {};      // chave ("T<id>" / "P<id>") -> JSON como está no servidor
let ver = {};         // id -> versão (`atualizado`) conhecida
let sujo = false, emVoo = false, denovo = false, timer = null, tentativa = 0, ultimaRecarga = 0;

const SNAP = 'claq:snap';
const chaves = () => {
  const o = {};
  L.series.forEach(s => o['T' + s.id] = JSON.stringify(s));
  L.tops.forEach(t => o['P' + t.id] = JSON.stringify(t));
  return o;
};
const diferente = () => { const a = chaves(); return Object.keys(a).some(k => a[k] !== remoto[k]) || Object.keys(remoto).some(k => !(k in a)); };
export const pendente = () => sujo;

/* ---------- carregar dados do servidor ---------- */
function tira(r) { const { atualizado, ...x } = r; ver[x.id] = atualizado; return x; }
function definir(d) {
  ver = {};
  L.series = (d.series || []).map(tira);
  L.tops = (d.tops || []).map(tira);
  remoto = chaves();
}

/* ---------- cópia local (offline) ---------- */
let tSnap = null;
function agendaSnap() { clearTimeout(tSnap); tSnap = setTimeout(salvarSnap, 500); }
function salvarSnap() {
  if (!L.usuario) return;
  guardar(SNAP, { uid: L.usuario.id, series: L.series, tops: L.tops, remoto, ver, blob: L.blob, usuario: L.usuario });
}
const lerSnap = () => lerJSON(SNAP);
export const limparSnap = () => { clearTimeout(tSnap); apagar(SNAP); };

// Reaplica sobre os dados do servidor o que ficou sem enviar no aparelho.
function reaplicar(snap) {
  let mudou = false;
  const apos = (lista, chave, snapLista, extra) => {
    for (const loc of snapLista) {
      const k = chave + loc.id;
      if (JSON.stringify(loc) === snap.remoto[k]) continue;                    // sem alteração local
      const i = lista.findIndex(x => x.id === loc.id);
      if (i < 0) { if (!snap.remoto[k]) { lista.unshift(loc); mudou = true; } continue; } // novo local (ou apagado em outro aparelho)
      const srv = lista[i], intocado = ver[loc.id] === snap.ver[loc.id];
      lista[i] = intocado || chave === 'P' ? loc : extra(loc, srv);
      mudou = true;
    }
    for (const k in snap.remoto) {                                              // apagados só neste aparelho
      if (k[0] !== chave || snapLista.some(x => x.id === k.slice(1))) continue;
      const i = lista.findIndex(x => x.id === k.slice(1));
      if (i >= 0) { lista.splice(i, 1); mudou = true; }
    }
  };
  apos(L.series, 'T', snap.series, mesclarTitulo);
  apos(L.tops, 'P', snap.tops, x => x);
  if (mudou) save();
}

export async function carregar() {
  const snap = lerSnap();
  try {
    const d = await api('/api/dados');
    L.usuario = d.usuario; L.blob = !!d.blob;
    definir(d);
    if (snap && snap.uid === d.usuario.id && snap.series) reaplicar(snap);
    else if (snap) limparSnap();                                   // cópia de outro usuário
    salvarSnap();
    return { offline: false };
  } catch (e) {
    if (e.auth) throw e;
    if ((e.rede || e.status >= 500) && snap && snap.series) {
      L.series = snap.series; L.tops = snap.tops; L.usuario = snap.usuario; L.blob = !!snap.blob;
      remoto = snap.remoto || {}; ver = snap.ver || {};
      faixa('Sem conexão. Mostrando a última versão salva neste aparelho.');
      if (diferente()) { sujo = true; agenda(5000); }
      return { offline: true };
    }
    throw e;
  }
}

/* ---------- salvar ---------- */
export function save() {
  sujo = true; status('Salvando…'); agendaSnap();
  agenda(300);
}
function agenda(ms) { clearTimeout(timer); timer = setTimeout(rodar, ms); }

async function enviar() {
  const atual = chaves(), T = [], P = [], del = { titulos: [], tops: [] };
  for (const k in atual) if (atual[k] !== remoto[k]) (k[0] === 'T' ? T : P).push(k);
  for (const k in remoto) if (!(k in atual)) del[k[0] === 'T' ? 'titulos' : 'tops'].push(k.slice(1));
  const comBase = k => ({ ...JSON.parse(atual[k]), base: ver[k.slice(1)] ?? null });
  const reqs = [];
  for (let i = 0; i < T.length; i += 15) { const c = T.slice(i, i + 15); reqs.push({ body: { titulos: c.map(comBase) }, keys: c }); }
  if (P.length) reqs.push({ body: { tops: P.map(comBase) }, keys: P });
  if (del.titulos.length || del.tops.length) reqs.push({ body: { del }, dels: [...del.titulos.map(i => 'T' + i), ...del.tops.map(i => 'P' + i)] });
  const conflitos = [];
  for (const r of reqs) {
    const j = await api('/api/sync', { method: 'POST', body: r.body });
    for (const k of r.keys || []) {
      const id = k.slice(1);
      if ((j.conflitos || []).includes(id)) conflitos.push(k);
      else { remoto[k] = atual[k]; if (j.versoes && j.versoes[id]) ver[id] = j.versoes[id]; }
    }
    for (const k of r.dels || []) { delete remoto[k]; delete ver[k.slice(1)]; }
  }
  return conflitos;
}

// Outro aparelho gravou antes: busca a versão do servidor e combina com a local.
async function resolver(conflitos) {
  const d = await api('/api/dados');
  const sT = new Map(d.series.map(s => [s.id, s])), sP = new Map(d.tops.map(t => [t.id, t]));
  const sem = r => { const { atualizado, ...x } = r; return x; };
  for (const k of conflitos) {
    const id = k.slice(1), tipoT = k[0] === 'T', srv = (tipoT ? sT : sP).get(id), lista = tipoT ? L.series : L.tops;
    const i = lista.findIndex(x => x.id === id);
    if (i < 0) continue;
    if (!srv) {
      if (remoto[k]) { lista.splice(i, 1); delete remoto[k]; delete ver[id]; }   // apagado em outro aparelho
      else ver[id] = null;                                                         // não existe lá: reenvia como novo
      continue;
    }
    ver[id] = srv.atualizado; remoto[k] = JSON.stringify(sem(srv));
    lista[i] = tipoT ? mesclarTitulo(lista[i], sem(srv)) : lista[i];              // tops: vale a edição local
  }
  // itens criados em outros aparelhos
  for (const s of d.series) if (!achar(s.id) && !('T' + s.id in remoto)) { L.series.push(tira(s)); remoto['T' + s.id] = JSON.stringify(L.series[L.series.length - 1]); }
  for (const t of d.tops) if (!L.tops.some(x => x.id === t.id) && !('P' + t.id in remoto)) { L.tops.push(tira(t)); remoto['P' + t.id] = JSON.stringify(L.tops[L.tops.length - 1]); }
  L.series.sort((a, b) => b.criado - a.criado); L.tops.sort((a, b) => b.criado - a.criado);
}

async function rodar() {
  if (emVoo) { denovo = true; return; }
  emVoo = true; denovo = false;
  try {
    for (let voltas = 0; ;) {
      const conf = await enviar();
      if (conf.length) {
        if (++voltas > 2) throw Object.assign(new Error('Não foi possível combinar com a versão de outro aparelho. Recarregue a página.'), { fatal: true });
        await resolver(conf); hooks.render(); aviso('Alterações de outro aparelho foram combinadas com as suas.');
        continue;
      }
      if (!diferente()) break;
    }
    tentativa = 0; sujo = false; faixa(navigator.onLine ? '' : 'Sem conexão.'); status('Salvo ✓'); salvarSnap();
  } catch (e) {
    if (e.auth) { salvarSnap(); hooks.login(); }
    else if (e.rede || e.status >= 500 || e.status === 429) {
      tentativa++;
      const s = Math.min(60, 2 * 2 ** (tentativa - 1));
      faixa('Sem conexão com o servidor. Suas alterações estão salvas neste aparelho e serão enviadas automaticamente.');
      status(`Não foi possível salvar. Nova tentativa em ${s}s…`, true);
      agenda(s * 1000); denovo = false; salvarSnap();
    } else { status('Erro ao salvar: ' + e.message, true); salvarSnap(); }
  } finally {
    emVoo = false;
    if (denovo) { denovo = false; agenda(0); }
  }
}

/* ---------- vários aparelhos: atualizar ao voltar para a aba ---------- */
export async function recarregarSuave({ ocupado = () => false } = {}) {
  if (sujo || emVoo || ocupado() || Date.now() - ultimaRecarga < 15000 || !navigator.onLine || !L.usuario) return;
  ultimaRecarga = Date.now();
  try {
    const d = await api('/api/dados');
    if (sujo || emVoo || ocupado()) return;                         // algo mudou enquanto buscava
    const antes = remoto;
    const novo = { series: d.series.map(tira), tops: d.tops.map(tira) };
    const L0 = { series: L.series, tops: L.tops };
    L.series = novo.series; L.tops = novo.tops;
    const depois = chaves();
    const igual = Object.keys(depois).length === Object.keys(antes).length && Object.keys(depois).every(k => depois[k] === antes[k]);
    if (igual) { L.series = L0.series; L.tops = L0.tops; remoto = antes; return; }
    remoto = depois; salvarSnap(); hooks.render(); aviso('Dados atualizados de outro aparelho.');
  } catch (e) { if (e.auth) hooks.login(); }
}

export function ligarRede() {
  addEventListener('online', () => { faixa(''); if (sujo) agenda(0); });
  addEventListener('offline', () => faixa('Sem conexão. As alterações ficam salvas neste aparelho.'));
  addEventListener('beforeunload', e => { if (sujo) { salvarSnap(); e.preventDefault(); } });
  if (!navigator.onLine) faixa('Sem conexão. As alterações ficam salvas neste aparelho.');
}

export function zerar() { L.series = []; L.tops = []; L.usuario = null; remoto = {}; ver = {}; sujo = false; clearTimeout(timer); }
