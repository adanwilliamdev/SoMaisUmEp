// Regras puras do app (sem DOM nem rede): fáceis de testar em Node.

export const tp = s => s.tipo || 'tv';
export const tot = s => s.eps.reduce((a, b) => a + b, 0);
export const vis = s => s.vis.reduce((a, b) => a + b, 0);
export const estado = s => {
  const v = vis(s);
  return v === 0 ? 'quero' : v >= tot(s) ? 'fim' : 'assistindo';
};
export const prox = s => {
  for (let i = 0; i < s.eps.length; i++) if (s.vis[i] < s.eps[i]) return [i + 1, s.vis[i] + 1];
  return null;
};
export const pct = s => Math.round((vis(s) / tot(s)) * 100);

export function rotulo(s) {
  const p = prox(s),
    e = estado(s);
  if (tp(s) === 'movie') return e === 'fim' ? 'Assistido ✓' : 'Na fila';
  return e === 'fim' ? 'Concluída ✓' : e === 'quero' ? 'Na fila' : `Próximo: T${p[0]} · E${p[1]}`;
}

/* ---------- busca, filtro e ordenação ---------- */
export const normaliza = t =>
  String(t == null ? '' : t)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function filtrar(lista, { estado: est = 'todas', busca = '' } = {}) {
  const q = normaliza(busca);
  return lista.filter(s => (est === 'todas' || estado(s) === est) && (!q || normaliza(s.nome).includes(q)));
}

export const ORDENS = [
  ['recente', 'Adicionados recentemente'],
  ['nome', 'Nome (A–Z)'],
  ['nota', 'Nota'],
  ['visto', 'Último visto'],
];

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
  return ordenar(
    series.filter(s => tp(s) === 'tv' && estado(s) === 'assistindo'),
    'visto',
  ).slice(0, max);
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
  const aceitos = [],
    repetidos = [];
  for (const n of novos) {
    const ja = atuais.some(x => x.id !== n.id && mesmoTitulo(x, n)) || aceitos.some(x => x.id !== n.id && mesmoTitulo(x, n));
    (ja ? repetidos : aceitos).push(n);
  }
  return { aceitos, repetidos };
}

/* ---------- progresso e histórico ---------- */
export const mesDe = t => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Chame depois de mudar `vis`; 'antes' é o total de episódios vistos antes da mudança.
export function registrarProgresso(s, antes, agora = Date.now()) {
  const d = vis(s) - antes;
  if (!d) return s;
  const m = mesDe(agora),
    hist = { ...(s.hist || {}) };
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
    if (tp(s) === 'movie') {
      if (v > 0) {
        r.filmes++;
        if (s.duracao) r.minutos += s.duracao;
        else r.semDuracao++;
      }
    } else {
      r.episodios += v;
      if (estado(s) === 'fim') r.concluidas++;
      if (v > 0) {
        if (s.duracao) r.minutos += v * s.duracao;
        else r.semDuracao++;
      }
    }
    if (s.nota_pessoal != null) {
      soma += s.nota_pessoal;
      r.nNotas++;
    }
    for (const [k, n] of Object.entries(s.hist || {})) r.porMes[k] = (r.porMes[k] || 0) + n;
  }
  if (r.nNotas) r.notaMedia = Math.round((soma / r.nNotas) * 10) / 10;
  return r;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
// Últimos n meses (do mais antigo ao atual), com zero nos meses sem registro.
export function ultimosMeses(porMes, n = 12, agora = Date.now()) {
  const d = new Date(agora),
    out = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1),
      k = mesDe(x);
    out.push({ mes: k, rotulo: MESES[x.getMonth()], ano: x.getFullYear(), valor: porMes[k] || 0 });
  }
  return out;
}

export function duracaoTexto(min) {
  const h = Math.floor(min / 60),
    m = Math.round(min % 60);
  if (h >= 48) return `${Math.round((h / 24) * 10) / 10} dias`;
  return h ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${m} min`;
}

/* ---------- datas de lançamento ---------- */
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
// 'AAAA-MM-DD' vira meia-noite no fuso do aparelho (new Date('AAAA-MM-DD') seria UTC e erraria o dia).
const dataLocal = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
export const hojeISO = (agora = Date.now()) => {
  const d = new Date(agora);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
function diasAte(iso, agora = Date.now()) {
  const d = dataLocal(iso),
    h = dataLocal(hojeISO(agora));
  return d ? Math.round((d - h) / 864e5) : null;
}

// Próximo lançamento de um título, pronto para mostrar. null se não há data ou se ela já passou.
export function lancamento(s, agora = Date.now()) {
  const p = s.proximo,
    dias = p ? diasAte(p.d, agora) : null;
  if (dias == null || dias < 0) return null;
  const d = dataLocal(p.d);
  const quando = dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : dias < 7 ? DIAS_SEMANA[d.getDay()] : `em ${d.getDate()} ${MESES[d.getMonth()]}`;
  const quem = tp(s) === 'movie' ? 'Estreia' : p.e === 1 && p.t > 1 ? 'Nova temporada' : 'Novo ep';
  return { dias, data: p.d, dia: d.getDate(), mes: MESES[d.getMonth()], t: p.t || null, e: p.e || null, quando, texto: `${quem} ${quando}`, hoje: dias === 0 };
}

// Lançamentos dos próximos `dias` dias (hoje incluído), do mais próximo ao mais distante. `tipo` filtra série/filme.
export function proximosLancamentos(series, { tipo = null, agora = Date.now(), dias = 30, max = 8 } = {}) {
  return series
    .filter(s => !tipo || tp(s) === tipo)
    .map(s => ({ s, l: lancamento(s, agora) }))
    .filter(x => x.l && x.l.dias <= dias)
    .sort((a, b) => a.l.dias - b.l.dias || a.s.nome.localeCompare(b.s.nome, 'pt-BR'))
    .slice(0, max);
}

// Títulos com data de lançamento já vencida ou de hoje: vale checar o TMDb de novo mais cedo.
export const lancamentoVencido = (s, agora = Date.now()) => !!(s.proximo && diasAte(s.proximo.d, agora) <= 0);

/* ---------- descobrir ---------- */
// Títulos que servem de ponto de partida para "parecidos com o que você viu": já começados, ligados ao TMDb,
// sem nota baixa. Quem você avaliou melhor vem antes; no empate, o visto mais recentemente.
export function sementes(series, tipo, max = 5) {
  return series
    .filter(s => tp(s) === tipo && s.tmdb && vis(s) > 0 && (s.nota_pessoal == null || s.nota_pessoal >= 6))
    .sort((a, b) => (b.nota_pessoal ?? 7) - (a.nota_pessoal ?? 7) || (b.visto_em || b.criado || 0) - (a.visto_em || a.criado || 0))
    .slice(0, max);
}
export const naEstante = (series, tipo, tmdb) => series.some(s => tp(s) === tipo && s.tmdb === tmdb);

/* ---------- radar de afinidade (aba Descobrir) ---------- */
// Pontos de partida do radar: só o que você de fato viu e curtiu. Entra quem tem nota sua >= 7 ou quem você concluiu sem avaliar
// (nesse caso vale como 7). Quem tem nota mais alta vem antes; no empate, o concluído e depois o visto mais recentemente.
export const NOTA_ALTA = 7;
const pesoRadar = s => (s.nota_pessoal != null ? s.nota_pessoal : NOTA_ALTA);
const concluido = s => (estado(s) === 'fim' ? 1 : 0);
const recente = s => s.visto_em || s.criado || 0;
export function sementesRadar(series, tipo, max = 6) {
  return series
    .filter(s => tp(s) === tipo && s.tmdb && vis(s) > 0 && (s.nota_pessoal != null ? s.nota_pessoal >= NOTA_ALTA : estado(s) === 'fim'))
    .sort((a, b) => pesoRadar(b) - pesoRadar(a) || concluido(b) - concluido(a) || recente(b) - recente(a))
    .slice(0, max);
}
// Parâmetro `ids` de /api/tmdb?acao=afinidade: "id" ou "id:nota".
export const idsRadar = sementes => sementes.map(s => (s.nota_pessoal != null ? `${s.tmdb}:${s.nota_pessoal}` : String(s.tmdb)));

const notaTxt = n => String(n).replace('.', ',');
// "Como você concluiu X e deu nota 10: mesmo diretor (Nolan)."
export function frasePorque(motivo, semente) {
  if (!motivo || !semente) return '';
  const filme = tp(semente) === 'movie',
    fim = estado(semente) === 'fim';
  const verbo = !fim ? 'viu' : filme ? 'assistiu' : 'concluiu';
  const nota = semente.nota_pessoal != null ? ` e deu nota ${notaTxt(semente.nota_pessoal)}` : '';
  const alvo = {
    dir: `${filme ? 'mesma direção' : 'mesma criação'} (${motivo.nome})`,
    ator: `com ${motivo.nome}, que também está lá`,
    genero: `mesmo clima: ${motivo.nome}`,
    rec: 'quem gosta de um costuma gostar do outro',
  }[motivo.tipo];
  return alvo ? `Como você ${verbo} ${semente.nome}${nota}: ${alvo}.` : '';
}
// O que se repete nas suas sementes (diretores, atores, gêneros) em rótulos curtos.
export function rotulosDna(dna) {
  if (!dna) return [];
  const f = (lista, rot) => (lista || []).map(x => ({ rot, nome: x.nome, n: x.n }));
  return [...f(dna.generos, 'Gênero'), ...f(dna.diretores, 'Direção'), ...f(dna.atores, 'Elenco')];
}

/* ---------- retrato do espectador (aba Estatísticas) ---------- */
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const mesPorExtenso = k => {
  const [a, m] = String(k).split('-');
  return `${MESES_LONGOS[+m - 1] || ''} de ${a}`;
};
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export function perfilEspectador(series, agora = Date.now()) {
  const r = estatisticas(series);
  // Mês mais ativo (empate: o mais recente).
  const meses = Object.entries(r.porMes).filter(([, n]) => n > 0);
  const topo = meses.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0];
  const mesAtivo = topo ? { mes: topo[0], rotulo: mesPorExtenso(topo[0]), valor: topo[1], atual: topo[0] === mesDe(agora) } : null;

  // Seu jeito de avaliar.
  const notas = series.filter(s => s.nota_pessoal != null).map(s => s.nota_pessoal);
  let jeito = null;
  if (notas.length) {
    const media = r.notaMedia,
      altas = notas.filter(n => n >= 8).length,
      dezes = notas.filter(n => n >= 10).length;
    const comTmdb = series.filter(s => s.nota_pessoal != null && s.nota != null);
    const dif = comTmdb.length >= 3 ? Math.round((comTmdb.reduce((a, s) => a + s.nota_pessoal - s.nota, 0) / comTmdb.length) * 10) / 10 : null;
    jeito = {
      n: notas.length,
      media,
      dezes,
      pctAltas: Math.round((altas / notas.length) * 100),
      dif, // quanto você nota acima (+) ou abaixo (−) da média do TMDb, nos títulos que têm as duas notas
      perfil: notas.length < 3 ? null : media < 6.5 ? 'rigoroso' : media < 8 ? 'equilibrado' : 'generoso',
    };
  }

  // Tempo, em comparações tangíveis.
  let tempo = null;
  if (r.minutos > 0) {
    const dias = Math.round((r.minutos / 1440) * 10) / 10;
    const comp = [];
    const trab = Math.round(r.minutos / 480),
      voos = Math.round(r.minutos / 600);
    if (trab >= 1) comp.push(`${plural(trab, 'jornada de trabalho', 'jornadas de trabalho')} de 8 h`);
    if (voos >= 1) comp.push(`${plural(voos, 'voo', 'voos')} São Paulo–Lisboa sem escala`);
    tempo = { minutos: r.minutos, dias, inteiros: Math.floor(r.minutos / 1440), comparacoes: comp, texto: duracaoTexto(r.minutos) };
  }

  // O título em que você mais investiu tempo.
  let campeao = null;
  for (const s of series) {
    if (!s.duracao) continue;
    const vistos = tp(s) === 'movie' ? Math.min(vis(s), 1) : vis(s);
    const min = s.duracao * vistos;
    if (min > 0 && (!campeao || min > campeao.minutos)) campeao = { nome: s.nome, minutos: min, tipo: tp(s) };
  }
  return { r, mesAtivo, jeito, tempo, campeao };
}

/* ---------- backup importado: nada do arquivo entra no app sem passar por aqui ---------- */
// Mesmas regras de api/_validar.js. O servidor sanea de novo ao salvar, mas o app desenha os dados ANTES disso;
// sem este filtro, um backup malicioso poderia pôr texto/aspas em ids e números que vão para atributos HTML.
const ID_OK = /^[\w-]{1,64}$/;
const MES_OK = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA_OK = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const num = (v, min, max, casas = 0) =>
  v == null || v === '' || !Number.isFinite(+v) ? null : Math.round(Math.min(max, Math.max(min, +v)) * 10 ** casas) / 10 ** casas;
const txt = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '') || null;
const CAPAS_OK = [
  /^https:\/\/image\.tmdb\.org\/[\w./-]+$/,
  /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/,
  /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/capas\/[\w-]{1,64}\/[\w./-]+$/,
];
export const capaSegura = c => (typeof c === 'string' && c.length <= 120000 && CAPAS_OK.some(r => r.test(c)) ? c : null);

export function limparTituloBackup(x, criadoPadrao = Date.now()) {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !ID_OK.test(x.id)) return null;
  if (!txt(x.nome, 80) || !Array.isArray(x.eps) || !Array.isArray(x.vis)) return null;
  const tipo = x.tipo === 'movie' ? 'movie' : 'tv';
  const eps = tipo === 'movie' ? [1] : x.eps.slice(0, 60).map(n => Math.max(1, num(n, 0, 999) || 0));
  if (!eps.length) return null;
  const vis = eps.map((n, i) => Math.min(num(x.vis[i], 0, 999) || 0, n));
  const hist = {};
  if (x.hist && typeof x.hist === 'object' && !Array.isArray(x.hist)) {
    for (const k of Object.keys(x.hist).slice(0, 240))
      if (MES_OK.test(k)) {
        const n = Math.max(0, Math.min(99999, parseInt(x.hist[k], 10) || 0));
        if (n) hist[k] = n;
      }
  }
  let proximo = null;
  if (x.proximo && typeof x.proximo === 'object' && DATA_OK.test(String(x.proximo.d || ''))) {
    proximo = { d: x.proximo.d };
    const t = num(x.proximo.t, 1, 999),
      e = num(x.proximo.e, 1, 9999);
    if (t) proximo.t = t;
    if (e) proximo.e = e;
  }
  return {
    id: x.id,
    tipo,
    nome: txt(x.nome, 80),
    capa: capaSegura(x.capa),
    sinopse: txt(x.sinopse, 2000),
    ano: txt(x.ano, 10),
    nota: num(x.nota, 0, 10, 1),
    duracao: num(x.duracao, 0, 1000),
    tmdb: num(x.tmdb, 0, 1e9),
    eps,
    vis,
    criado: num(x.criado, 0, 8.64e15) ?? criadoPadrao,
    nota_pessoal: num(x.nota_pessoal, 0, 10, 1),
    resenha: txt(x.resenha, 4000),
    visto_em: num(x.visto_em, 0, 8.64e15),
    hist,
    proximo,
  };
}

// Tamanho máximo da nota de rodapé de um item do top (igual a api/_validar.js).
export const OBS_MAX = 160;

export function limparTopBackup(x, criadoPadrao = Date.now()) {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !ID_OK.test(x.id) || !Array.isArray(x.itens)) return null;
  const itens = x.itens
    .slice(0, 10)
    .map(i => ({
      t: txt(i && i.t, 80),
      sid: i && typeof i.sid === 'string' && ID_OK.test(i.sid) ? i.sid : undefined,
      obs: txt(i && i.obs, OBS_MAX) || undefined,
    }))
    .filter(i => i.t);
  return { id: x.id, nome: txt(x.nome, 60) || 'Top 10', itens, criado: num(x.criado, 0, 8.64e15) ?? criadoPadrao };
}
