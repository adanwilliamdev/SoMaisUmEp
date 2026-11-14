// Acesso ao TMDb compartilhado por /api/tmdb e /api/importar.
const { erro } = require('./_erro');

const IMG = 'https://image.tmdb.org/t/p/w342';
const poster = p => (p ? IMG + p : null);
const ano = x => (x.first_air_date || x.release_date || '').slice(0, 4);

// Aceita a chave em qualquer uma das duas variáveis: o tipo é detectado pelo formato.
// v4 (token de leitura) é um JWT longo "eyJ..."; v3 (chave de API) tem 32 caracteres hexadecimais.
const limpa = v =>
  String(v || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
function credencial() {
  for (const v of [process.env.TMDB_READ_TOKEN, process.env.TMDB_API_KEY].map(limpa).filter(Boolean)) {
    if (/^eyJ/.test(v) || v.length > 60) return { token: v };
    return { chave: v };
  }
  return null;
}

const configurado = () => !!credencial();

async function chamar(path, params = {}) {
  const cred = credencial();
  if (!cred) throw erro('TMDb não configurado no servidor (defina TMDB_READ_TOKEN ou TMDB_API_KEY).', 500);
  const { token, chave } = cred;
  const u = new URL('https://api.themoviedb.org/3' + path);
  u.searchParams.set('language', 'pt-BR');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (!token) u.searchParams.set('api_key', chave);
  let r;
  try {
    r = await fetch(u, { headers: token ? { Authorization: 'Bearer ' + token } : {}, signal: AbortSignal.timeout(8000) });
  } catch (e) {
    throw erro('Não foi possível falar com o TMDb.', 502);
  }
  if (!r.ok)
    throw erro(
      r.status === 401
        ? 'O TMDb recusou a chave. Em TMDB_READ_TOKEN use o "Token de Leitura da API" (começa com eyJ) ou, em TMDB_API_KEY, a "Chave da API" de 32 caracteres, sem aspas ou espaços.'
        : 'Não foi possível falar com o TMDb.',
      502,
    );
  return r.json();
}

// Resumo de um resultado de busca/lista (tendências, recomendações).
const resumo = x => ({
  id: x.id,
  nome: x.name || x.title,
  ano: ano(x),
  poster: poster(x.poster_path),
  nota: x.vote_average ? Math.round(x.vote_average * 10) / 10 : null,
  sinopse: String(x.overview || '').slice(0, 300),
});

const DATA = /^\d{4}-\d{2}-\d{2}$/;
// Próximo episódio a ir ao ar (séries) ou data de estreia ainda no futuro (filmes). `hoje` = 'AAAA-MM-DD'.
function proximoDe(d, tipo, hoje = new Date().toISOString().slice(0, 10)) {
  if (tipo === 'movie') return DATA.test(d.release_date || '') && d.release_date >= hoje ? { d: d.release_date } : null;
  const e = d.next_episode_to_air;
  if (!e || !DATA.test(e.air_date || '')) return null;
  return { d: e.air_date, ...(e.season_number > 0 ? { t: e.season_number } : {}), ...(e.episode_number > 0 ? { e: e.episode_number } : {}) };
}

// Formato único de "detalhe" usado pelo app. `nums` = número real de cada temporada em `eps` (o TMDb pode pular números).
function detalheDe(d, tipo) {
  const temps = (d.seasons || []).filter(s => s.season_number > 0 && s.episode_count > 0);
  return {
    tmdb: d.id,
    nome: d.name || d.title,
    ano: ano(d),
    sinopse: d.overview || '',
    poster: poster(d.poster_path),
    nota: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
    duracao: d.runtime || (d.episode_run_time || [])[0] || (d.last_episode_to_air && d.last_episode_to_air.runtime) || null,
    eps: temps.map(s => s.episode_count),
    nums: temps.map(s => s.season_number),
    proximo: proximoDe(d, tipo),
  };
}
const detalhe = async (tipo, id) => detalheDe(await chamar('/' + tipo + '/' + id), tipo);

module.exports = { poster, ano, chamar, configurado, resumo, proximoDe, detalheDe, detalhe };
