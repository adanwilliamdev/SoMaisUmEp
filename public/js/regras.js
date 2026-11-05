// Regras puras do app (sem DOM nem rede): fáceis de testar em Node.

export const tp = s => s.tipo || 'tv';
export const tot = s => s.eps.reduce((a, b) => a + b, 0);
export const vis = s => s.vis.reduce((a, b) => a + b, 0);
export const estado = s => { const v = vis(s); return v === 0 ? 'quero' : v >= tot(s) ? 'fim' : 'assistindo'; };
export const prox = s => { for (let i = 0; i < s.eps.length; i++) if (s.vis[i] < s.eps[i]) return [i + 1, s.vis[i] + 1]; return null; };
export const pct = s => Math.round(vis(s) / tot(s) * 100);

export function rotulo(s) {
  const p = prox(s), e = estado(s);
  if (tp(s) === 'movie') return e === 'fim' ? 'Assistido ✓' : 'Na fila';
  return e === 'fim' ? 'Concluída ✓' : e === 'quero' ? 'Na fila' : `Próximo: T${p[0]} · E${p[1]}`;
}

/* ---------- busca, filtro e ordenação ---------- */
export const normaliza = t => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function filtrar(lista, { estado: est = 'todas', busca = '' } = {}) {
  const q = normaliza(busca);
  return lista.filter(s => (est === 'todas' || estado(s) === est) && (!q || normaliza(s.nome).includes(q)));
}

export const ORDENS = [['recente', 'Adicionados recentemente'], ['nome', 'Nome (A–Z)'], ['nota', 'Nota'], ['visto', 'Último visto']];

// Nota usada para ordenar: a sua nota, se existir; senão a do TMDb.
const notaDe = s => (s.nota_pessoal != null ? s.nota_pessoal : s.nota != null ? s.nota : -1);

export function ordenar(lista, modo = 'recente') {
  const c = [...lista];
  const porRecente = (a, b) => (b.criado || 0) - (a.criado || 0);
  if (modo === 'nome') c.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) || porRecente(a, b));
  else if (modo === 'nota') c.sort((a, b) => notaDe(b) - notaDe(a) || porRecente(a, b));
  else if (modo === 'visto') c.sort((a, b) => (b.visto_em || 0) - (a.visto_em || 0) || porRecente(a, b));
  else c.sort(porRecente);
  return c;
}

// "Continuar assistindo": séries em andamento, a mais recente primeiro.
export function continuar(series, max = 12) {
  return ordenar(series.filter(s => tp(s) === 'tv' && estado(s) === 'assistindo'), 'visto').slice(0, max);
}

/* ---------- itens duplicados ---------- */
// Dois itens são o mesmo título quando têm o mesmo tipo (série/filme) e:
//  - o mesmo id do TMDb (quando os dois têm); ou
//  - o mesmo nome (ignorando acento, maiúsculas e espaços repetidos), desde que não haja
//    sinal claro de que são obras diferentes (TMDb diferente ou anos diferentes, como em remakes).
const nomeChave = t => normaliza(t).replace(/\s+/g, ' ');

export function mesmoTitulo(a, b) {
  if (!a || !b || tp(a) !== tp(b)) return false;
  if (a.tmdb && b.tmdb) return a.tmdb === b.tmdb;
  if (nomeChave(a.nome) !== nomeChave(b.nome)) return false;
  if (a.ano && b.ano && a.ano !== b.ano) return false;
  return true;
}

// Procura na lista um título igual ao candidato. `ignorarId` serve ao editar (não comparar consigo mesmo).
export const acharDuplicado = (lista, cand, ignorarId = null) => lista.find(x => x.id !== ignorarId && mesmoTitulo(x, cand)) || null;

// Para importar backup: separa o que entra do que já existe (ou está repetido dentro do próprio arquivo).
export function semDuplicados(novos, atuais) {
  const aceitos = [], repetidos = [];
  for (const n of novos) {
    const ja = atuais.some(x => x.id !== n.id && mesmoTitulo(x, n)) || aceitos.some(x => x.id !== n.id && mesmoTitulo(x, n));
    (ja ? repetidos : aceitos).push(n);
  }
  return { aceitos, repetidos };
}

/* ---------- progresso e histórico ---------- */
export const mesDe = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// Chame depois de mudar `vis`; 'antes' é o total de episódios vistos antes da mudança.
export function registrarProgresso(s, antes, agora = Date.now()) {
  const d = vis(s) - antes;
  if (!d) return s;
  const m = mesDe(agora), hist = { ...(s.hist || {}) };
  hist[m] = Math.max(0, (hist[m] || 0) + d);
  if (!hist[m]) delete hist[m];
  s.hist = hist;
  if (d > 0) s.visto_em = agora;
  return s;
}

/* ---------- temporadas novas ---------- */
// Une o que você já tem com o que o TMDb informa, sem nunca diminuir temporadas ou episódios.
export function fundirEps(local, tmdb) {
  const n = Math.max(local.length, tmdb.length);
  return Array.from({ length: n }, (_, i) => Math.max(local[i] || 0, tmdb[i] || 0)).filter((x, i) => x > 0 || i < local.length);
}
export function aplicarEps(s, novosEps) {
  const eps = fundirEps(s.eps, novosEps);
  if (eps.length === s.eps.length && eps.every((n, i) => n === s.eps[i])) return false;
  s.vis = eps.map((n, i) => Math.min(s.vis[i] || 0, n));
  s.eps = eps;
  return true;
}

/* ---------- mesclar versões (edição em dois aparelhos) ---------- */
// srv = versão do servidor, loc = versão deste aparelho. Metadados do servidor vencem
// se mudaram lá; o progresso nunca regride (máximo por temporada) quando as temporadas coincidem.
export function mesclarTitulo(loc, srv) {
  if (!srv) return loc;
  const m = { ...srv };
  const mesmo = loc.eps.length === srv.eps.length && loc.eps.every((n, i) => n === srv.eps[i]);
  if (mesmo) m.vis = srv.vis.map((v, i) => Math.max(v, loc.vis[i] || 0));
  m.visto_em = Math.max(srv.visto_em || 0, loc.visto_em || 0) || null;
  const h = { ...(srv.hist || {}) };
  for (const [k, v] of Object.entries(loc.hist || {})) h[k] = Math.max(h[k] || 0, v);
  m.hist = h;
  if (loc.nota_pessoal != null && srv.nota_pessoal == null) m.nota_pessoal = loc.nota_pessoal;
  if (loc.resenha && !srv.resenha) m.resenha = loc.resenha;
  return m;
}

/* ---------- estatísticas ---------- */
export function estatisticas(series) {
  const r = { episodios: 0, filmes: 0, concluidas: 0, minutos: 0, semDuracao: 0, notaMedia: null, nNotas: 0, porMes: {} };
  let soma = 0;
  for (const s of series) {
    const v = vis(s);
    if (tp(s) === 'movie') { if (v > 0) { r.filmes++; if (s.duracao) r.minutos += s.duracao; else r.semDuracao++; } }
    else { r.episodios += v; if (estado(s) === 'fim') r.concluidas++; if (v > 0) { if (s.duracao) r.minutos += v * s.duracao; else r.semDuracao++; } }
    if (s.nota_pessoal != null) { soma += s.nota_pessoal; r.nNotas++; }
    for (const [k, n] of Object.entries(s.hist || {})) r.porMes[k] = (r.porMes[k] || 0) + n;
  }
  if (r.nNotas) r.notaMedia = Math.round(soma / r.nNotas * 10) / 10;
  return r;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
// Últimos n meses (do mais antigo ao atual), com zero nos meses sem registro.
export function ultimosMeses(porMes, n = 12, agora = Date.now()) {
  const d = new Date(agora), out = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1), k = mesDe(x);
    out.push({ mes: k, rotulo: MESES[x.getMonth()], ano: x.getFullYear(), valor: porMes[k] || 0 });
  }
  return out;
}

export function duracaoTexto(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (h >= 48) return `${Math.round(h / 24 * 10) / 10} dias`;
  return h ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${m} min`;
}

/* ---------- datas de lançamento ---------- */
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
// 'AAAA-MM-DD' vira meia-noite no fuso do aparelho (new Date('AAAA-MM-DD') seria UTC e erraria o dia).
export const dataLocal = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
export const hojeISO = (agora = Date.now()) => { const d = new Date(agora); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function diasAte(iso, agora = Date.now()) {
  const d = dataLocal(iso), h = dataLocal(hojeISO(agora));
  return d ? Math.round((d - h) / 864e5) : null;
}

// Próximo lançamento de um título, pronto para mostrar. null se não há data ou se ela já passou.
export function lancamento(s, agora = Date.now()) {
  const p = s.proximo, dias = p ? diasAte(p.d, agora) : null;
  if (dias == null || dias < 0) return null;
  const d = dataLocal(p.d);
  const quando = dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : dias < 7 ? DIAS_SEMANA[d.getDay()] : `em ${d.getDate()} ${MESES[d.getMonth()]}`;
  const quem = tp(s) === 'movie' ? 'Estreia' : p.e === 1 && p.t > 1 ? 'Nova temporada' : 'Novo ep';
  return { dias, data: p.d, dia: d.getDate(), mes: MESES[d.getMonth()], t: p.t || null, e: p.e || null, quando, texto: `${quem} ${quando}`, hoje: dias === 0 };
}

// Lançamentos dos próximos `dias` dias (hoje incluído), do mais próximo ao mais distante. `tipo` filtra série/filme.
export function proximosLancamentos(series, { tipo = null, agora = Date.now(), dias = 30, max = 8 } = {}) {
  return series.filter(s => !tipo || tp(s) === tipo).map(s => ({ s, l: lancamento(s, agora) })).filter(x => x.l && x.l.dias <= dias)
    .sort((a, b) => a.l.dias - b.l.dias || a.s.nome.localeCompare(b.s.nome, 'pt-BR')).slice(0, max);
}

// Títulos com data de lançamento já vencida ou de hoje: vale checar o TMDb de novo mais cedo.
export const lancamentoVencido = (s, agora = Date.now()) => !!(s.proximo && diasAte(s.proximo.d, agora) <= 0);

/* ---------- descobrir ---------- */
// Títulos que servem de ponto de partida para "parecidos com o que você viu": já começados, ligados ao TMDb,
// sem nota baixa. Quem você avaliou melhor vem antes; no empate, o visto mais recentemente.
export function sementes(series, tipo, max = 5) {
  return series.filter(s => tp(s) === tipo && s.tmdb && vis(s) > 0 && (s.nota_pessoal == null || s.nota_pessoal >= 6))
    .sort((a, b) => (b.nota_pessoal ?? 7) - (a.nota_pessoal ?? 7) || (b.visto_em || b.criado || 0) - (a.visto_em || a.criado || 0))
    .slice(0, max);
}
export const naEstante = (series, tipo, tmdb) => series.some(s => tp(s) === tipo && s.tmdb === tmdb);
