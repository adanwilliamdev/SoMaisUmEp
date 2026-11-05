// Importação de listas de outros serviços (Trakt, Letterboxd, IMDb). Só funções puras (sem DOM nem rede):
// leem os arquivos exportados, juntam tudo em uma lista única e montam os títulos do app.
// A busca no TMDb é feita pela tela (via /api/importar).
import { normaliza, mesDe } from './regras.js';

/* ---------- CSV ---------- */
// Lê CSV com aspas, aspas duplicadas e quebras de linha dentro de campos. Devolve objetos pelo cabeçalho.
export function csv(texto) {
  const t = String(texto || '').replace(/^\uFEFF/, ''), linhas = [];
  let campo = '', linha = [], aspas = false;
  const fimCampo = () => { linha.push(campo); campo = ''; };
  const fimLinha = () => { fimCampo(); if (linha.length > 1 || linha[0] !== '') linhas.push(linha); linha = []; };
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) { if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; }
    else if (c === '"') aspas = true;
    else if (c === ',') fimCampo();
    else if (c === '\n') fimLinha();
    else if (c !== '\r') campo += c;
  }
  if (campo !== '' || linha.length) fimLinha();
  if (!linhas.length) return [];
  const cab = linhas[0].map(h => h.trim());
  return linhas.slice(1).map(l => Object.fromEntries(cab.map((h, i) => [h, (l[i] ?? '').trim()])));
}

/* ---------- ZIP (o Letterboxd exporta um .zip de CSVs) ---------- */
// Leitor mínimo: arquivos "guardados" ou deflate (o normal). Usa DecompressionStream do navegador, sem biblioteca.
// `quer(nome)` decide quais arquivos descompactar. Devolve [{ nome, texto }].
export async function lerZip(buffer, quer = () => true) {
  const b = new Uint8Array(buffer), v = new DataView(b.buffer, b.byteOffset, b.byteLength), saida = [];
  let fim = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  if (fim < 0) throw new Error('Arquivo ZIP inválido.');
  const n = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  if (n === 0xffff || p === 0xffffffff) throw new Error('ZIP grande demais. Extraia o arquivo e envie os CSV.');
  const dec = new TextDecoder('utf-8');
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Arquivo ZIP inválido.');
    const metodo = v.getUint16(p + 10, true), comp = v.getUint32(p + 20, true), tam = v.getUint32(p + 24, true);
    const nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
    const nome = dec.decode(b.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + el + cl;
    if (nome.endsWith('/') || !quer(nome) || tam > 40e6) continue;
    if (v.getUint32(lo, true) !== 0x04034b50) throw new Error('Arquivo ZIP inválido.');
    const ini = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true), dados = b.subarray(ini, ini + comp);
    let bruto;
    if (metodo === 0) bruto = dados;
    else if (metodo === 8) bruto = new Uint8Array(await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else continue;
    saida.push({ nome, texto: dec.decode(bruto) });
  }
  return saida;
}

/* ---------- leitura de cada formato ---------- */
// Entrada normalizada: { tipo, nome, ano, tmdb, imdb, assistido, nota (0 a 10), resenha, data (ms), episodios: [{ t, e, data }] }
// Data sem hora ("2024-05-01") vale meio-dia no fuso do aparelho: Date.parse a trataria como UTC e, no Brasil, cairia no dia (ou mês) anterior.
const ms = v => {
  const s = String(v || '').trim(), d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (d) return new Date(+d[1], +d[2] - 1, +d[3], 12).getTime();
  const t = Date.parse(s.replace(' ', 'T'));
  return Number.isFinite(t) ? t : null;
};
const anoDe = v => (/^\d{4}$/.test(String(v || '').trim()) ? String(v).trim() : null);
const semHtml = t => String(t || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim() || null;
const notaDe = (v, mult = 1) => { const n = parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.min(10, Math.round(n * mult * 10) / 10) : null; };

// Letterboxd: watched.csv, ratings.csv, diary.csv, reviews.csv, watchlist.csv (só filmes). Nota de 0,5 a 5 estrelas.
function letterboxd(arq, linhas) {
  const base = arq.toLowerCase().split('/').pop();
  const assistido = base !== 'watchlist.csv';
  return linhas.filter(l => l.Name).map(l => ({
    tipo: 'movie', nome: l.Name, ano: anoDe(l.Year), assistido,
    nota: assistido ? notaDe(l.Rating, 2) : null,
    resenha: base === 'reviews.csv' || l.Review ? semHtml(l.Review) : null,
    data: assistido ? ms(l['Watched Date'] || l.Date) : null,
  }));
}

// IMDb: "Your Ratings" (tem "Your Rating") ou watchlist/listas (não tem). Só entram filmes e séries.
const TIPO_IMDB = { movie: 'movie', tvmovie: 'movie', video: 'movie', short: 'movie', tvshort: 'movie', tvspecial: 'movie', tvseries: 'tv', tvminiseries: 'tv' };
function imdb(linhas) {
  const out = []; let ignorados = 0;
  for (const l of linhas) {
    const tipo = TIPO_IMDB[normaliza(l['Title Type']).replace(/[^a-z]/g, '')];
    if (!tipo || !/^tt\d+$/.test(l.Const || '')) { if (l.Const) ignorados++; continue; }
    const avaliou = 'Your Rating' in l;
    out.push({ tipo, nome: l.Title || l['Original Title'], ano: anoDe(l.Year), imdb: l.Const,
      assistido: avaliou && tipo === 'movie', nota: avaliou ? notaDe(l['Your Rating']) : null,
      data: avaliou ? ms(l['Date Rated']) : null, soAvaliou: avaliou && tipo === 'tv' });
  }
  return { entradas: out, ignorados };
}

// Trakt: JSON no formato da API (watched, history, ratings, watchlist), solto ou dentro de um objeto com essas chaves.
function trakt(dados) {
  const lista = [];
  const junta = v => { if (Array.isArray(v)) lista.push(...v); else if (v && typeof v === 'object') Object.values(v).forEach(x => Array.isArray(x) && lista.push(...x)); };
  junta(dados);
  const out = []; let ignorados = 0;
  for (const it of lista) {
    if (!it || typeof it !== 'object') continue;
    const m = it.movie || null, sh = it.show || null, obj = m || sh;
    if (!obj || !obj.title || 'collected_at' in it) { ignorados++; continue; }   // coleção não é "assistido"
    const ids = obj.ids || {}, base = { tipo: m ? 'movie' : 'tv', nome: obj.title, ano: anoDe(obj.year), tmdb: ids.tmdb ? String(ids.tmdb) : null, imdb: ids.imdb || null };
    if ('rating' in it) out.push({ ...base, nota: notaDe(it.rating), assistido: !!m, data: ms(it.rated_at), soAvaliou: !m });
    else if ('listed_at' in it && !('watched_at' in it) && !('last_watched_at' in it)) out.push({ ...base, assistido: false });
    else if (it.episode && sh) out.push({ ...base, assistido: true, episodios: [{ t: it.episode.season, e: it.episode.number, data: ms(it.watched_at) }], data: ms(it.watched_at) });
    else if (m) out.push({ ...base, assistido: true, data: ms(it.watched_at || it.last_watched_at) });
    else if (Array.isArray(it.seasons)) {
      const episodios = it.seasons.flatMap(s => (s.episodes || []).map(e => ({ t: s.number, e: e.number, data: ms(e.last_watched_at) })));
      out.push({ ...base, assistido: episodios.length > 0, episodios, data: ms(it.last_watched_at) });
    } else out.push({ ...base, assistido: false });
  }
  return { entradas: out, ignorados };
}

// Lê um arquivo (nome + texto). Devolve { fonte, entradas, ignorados } ou null se não for um formato conhecido.
export function lerArquivo(nome, texto) {
  const n = String(nome || '').toLowerCase();
  if (/(^|\/)(deleted|orphaned|lists|likes)\//.test(n)) return null;
  if (n.endsWith('.json')) {
    let j; try { j = JSON.parse(texto); } catch (e) { return null; }
    const r = trakt(j);
    return r.entradas.length ? { fonte: 'Trakt', ...r } : null;
  }
  if (!n.endsWith('.csv')) return null;
  const linhas = csv(texto), cab = linhas.length ? Object.keys(linhas[0]) : [];
  if (cab.includes('Const') && cab.includes('Title Type')) return { fonte: 'IMDb', ...imdb(linhas) };
  if (cab.includes('Letterboxd URI') && cab.includes('Name')) {
    if (!/(^|\/)(watched|ratings|diary|reviews|watchlist)\.csv$/.test(n)) return null;
    return { fonte: 'Letterboxd', entradas: letterboxd(n, linhas), ignorados: 0 };
  }
  return null;
}

/* ---------- juntar tudo ---------- */
const chaveDe = e => (e.tmdb ? `${e.tipo}:t${e.tmdb}` : e.imdb ? `${e.tipo}:i${e.imdb}` : `${e.tipo}:n${normaliza(e.nome)}|${e.ano || ''}`);

// Une entradas do mesmo título (ex.: watched.csv + ratings.csv + watchlist.csv): "assistido" vence "para ver",
// a nota e a resenha preenchidas vencem as vazias, e a data mais recente vale.
export function consolidar(entradas) {
  const mapa = new Map();
  for (const e of entradas) {
    if (!e.nome) continue;
    const k = chaveDe(e), a = mapa.get(k);
    if (!a) { mapa.set(k, { ...e, episodios: [...(e.episodios || [])] }); continue; }
    a.assistido = a.assistido || e.assistido;
    a.nota = e.nota ?? a.nota ?? null; a.resenha = e.resenha || a.resenha || null;
    a.data = Math.max(a.data || 0, e.data || 0) || null;
    a.soAvaliou = a.soAvaliou && e.soAvaliou;
    a.tmdb = a.tmdb || e.tmdb || null; a.imdb = a.imdb || e.imdb || null;
    a.episodios.push(...(e.episodios || []));
  }
  for (const a of mapa.values()) {  // episódio repetido (T:E): fica a data mais recente
    const eps = new Map();
    for (const x of a.episodios) { const k = x.t + ':' + x.e, o = eps.get(k); if (!o || (x.data || 0) > (o.data || 0)) eps.set(k, x); }
    a.episodios = [...eps.values()];
  }
  return [...mapa.values()];
}

export function resumoImportacao(entradas) {
  const r = { filmesVistos: 0, filmesFila: 0, series: 0, episodios: 0, seriesSemProgresso: 0 };
  for (const e of entradas) {
    if (e.tipo === 'movie') e.assistido ? r.filmesVistos++ : r.filmesFila++;
    else { r.series++; r.episodios += e.episodios.length; if (!e.episodios.length) r.seriesSemProgresso++; }
  }
  return r;
}

/* ---------- montar o título do app ---------- */
// `info` é a resposta de /api/importar (dados do TMDb). Séries: o progresso de cada temporada é o maior episódio visto
// (o app conta "do primeiro até o N"); o histórico por mês conta cada episódio com data conhecida.
export function montarTitulo(e, info, { id, criado = Date.now() }) {
  const base = { id, tipo: e.tipo, criado, nome: info.nome || e.nome, capa: info.poster || null, sinopse: info.sinopse || null, ano: info.ano || e.ano || null,
    nota: info.nota ?? null, duracao: info.duracao ?? null, tmdb: info.tmdb, nota_pessoal: e.nota ?? null, resenha: e.resenha || null, proximo: info.proximo || null };
  const hist = {}, soma = d => { if (d) hist[mesDe(d)] = (hist[mesDe(d)] || 0) + 1; };
  if (e.tipo === 'movie') {
    if (e.assistido) soma(e.data);
    return { ...base, eps: [1], vis: [e.assistido ? 1 : 0], visto_em: e.assistido ? e.data || null : null, hist };
  }
  const eps = info.eps, nums = info.nums && info.nums.length === eps.length ? info.nums : eps.map((_, i) => i + 1);
  const vis = eps.map(() => 0); let ultimo = null;
  for (const x of e.episodios) {
    const i = nums.indexOf(x.t);
    if (i < 0 || !(x.e >= 1) || x.e > eps[i]) continue;               // especiais (T0) e episódios que o TMDb não conhece
    vis[i] = Math.max(vis[i], x.e); soma(x.data);
    if (x.data) ultimo = Math.max(ultimo || 0, x.data);
  }
  return { ...base, eps, vis, visto_em: ultimo || (vis.some(Boolean) ? e.data || null : null), hist };
}

/* ---------- limite por importação ---------- */
// Cada título custa de 1 a 3 chamadas ao TMDb (o servidor aceita 400 lotes de 10 por hora por conta). Acima do limite,
// importa os primeiros e avisa quantos ficaram para uma segunda rodada. Para essa segunda rodada andar, o corte descarta
// antes o que a estante já tem (`jaTem`) e põe os assistidos na frente (a ordem original é mantida dentro de cada grupo).
export const MAX_IMPORTACAO = 3000;
export function limitarImportacao(entradas, jaTem = () => false, max = MAX_IMPORTACAO) {
  if (entradas.length <= max) return { entradas, cortadas: 0 };
  const novas = entradas.map((e, i) => [e, i]).filter(([e]) => !jaTem(e))
    .sort((a, b) => (b[0].assistido ? 1 : 0) - (a[0].assistido ? 1 : 0) || a[1] - b[1]).map(([e]) => e);
  return { entradas: novas.slice(0, max), cortadas: Math.max(0, novas.length - max) };
}
