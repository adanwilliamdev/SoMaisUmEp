// Exportação em formatos padrão: planilha (CSV com todos os títulos) e arquivo de importação do Letterboxd (só filmes).
// Só funções puras (sem DOM nem rede), para poderem ser testadas; o download fica em telas/backup.js.
import { tp, tot, vis, estado, hojeISO } from './regras.js';

/* ---------- CSV ---------- */
// Planilhas (Excel, Sheets, LibreOffice) executam como fórmula uma célula que começa com = + - @ (ou tab/CR).
// Um título ou uma resenha digitados pela pessoa não podem virar fórmula ao abrir o arquivo: antepõe-se um apóstrofo.
// Números legítimos (ex.: -3) ficam como estão. O arquivo do Letterboxd não passa por planilha, então não recebe o apóstrofo.
const FORMULA = /^[=+\-@\t\r]/;
const NUMERO = /^-?\d+(?:[.,]\d+)?$/;

export function celula(valor, { planilha = true } = {}) {
  let t = valor == null ? '' : String(valor);
  if (planilha && FORMULA.test(t) && !NUMERO.test(t)) t = "'" + t;
  return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

// Cabeçalho + linhas, separados por CRLF (padrão do CSV). `bom` acrescenta o marcador UTF-8 que o Excel precisa para acertar os acentos.
export function paraCsv(cabecalho, linhas, { planilha = true, bom = true } = {}) {
  const l = cols => cols.map(c => celula(c, { planilha })).join(',');
  return (bom ? '\uFEFF' : '') + [cabecalho, ...linhas].map(l).join('\r\n') + '\r\n';
}

/* ---------- planilha: todos os títulos ---------- */
export const COLUNAS_PLANILHA = [
  'tipo',
  'titulo',
  'ano',
  'tmdb_id',
  'estado',
  'temporadas',
  'episodios_total',
  'episodios_vistos',
  'eps_por_temporada',
  'vistos_por_temporada',
  'nota_tmdb',
  'minha_nota',
  'assistido_em',
  'proximo_lancamento',
  'resenha',
  'adicionado_em',
];

const ESTADOS = { assistindo: 'assistindo', quero: 'na_fila', fim: 'concluido' };
const data = ms => (Number.isFinite(+ms) && +ms > 0 ? hojeISO(+ms) : '');

export function linhaPlanilha(s) {
  const filme = tp(s) === 'movie';
  return [
    filme ? 'filme' : 'serie',
    s.nome,
    s.ano,
    s.tmdb,
    ESTADOS[estado(s)] || estado(s),
    filme ? '' : s.eps.length,
    tot(s),
    vis(s),
    filme ? '' : s.eps.join(';'),
    filme ? '' : s.vis.join(';'),
    s.nota,
    s.nota_pessoal,
    data(s.visto_em),
    s.proximo ? s.proximo.d : '',
    s.resenha,
    data(s.criado),
  ];
}

export const planilha = series => paraCsv(COLUNAS_PLANILHA, series.map(linhaPlanilha));

/* ---------- Letterboxd ---------- */
// Formato de importação do Letterboxd (letterboxd.com/about/importing-data): CSV em UTF-8 com as colunas tmdbID, Title, Year,
// WatchedDate (AAAA-MM-DD), Rating (0,5 a 5 estrelas) e Review (aceita HTML). O Letterboxd só tem filmes: séries não entram.
export const COLUNAS_LETTERBOXD = ['tmdbID', 'Title', 'Year', 'WatchedDate', 'Rating', 'Review'];

// Nota de 0 a 10 do app -> estrelas de 0,5 a 5 (passo de meia estrela). Sem nota (ou 0) fica vazio.
export function estrelas(nota) {
  if (nota == null || nota === '' || !Number.isFinite(+nota) || +nota <= 0) return '';
  return String(Math.min(5, Math.max(0.5, Math.round(+nota) / 2)));
}

// A resenha é texto puro no app e HTML no Letterboxd: escapa os símbolos e mantém as quebras de linha.
export const resenhaHtml = t =>
  String(t || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, '<br>');

export const filmesAssistidos = series => series.filter(s => tp(s) === 'movie' && vis(s) > 0);

export function linhaLetterboxd(s) {
  const ano = /^\d{4}/.exec(String(s.ano || ''));
  return [s.tmdb || '', s.nome, ano ? ano[0] : '', data(s.visto_em), estrelas(s.nota_pessoal), resenhaHtml(s.resenha)];
}

export const letterboxd = series => paraCsv(COLUNAS_LETTERBOXD, filmesAssistidos(series).map(linhaLetterboxd), { planilha: false, bom: false });
