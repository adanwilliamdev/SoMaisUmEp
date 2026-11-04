const { rota, erro } = require('./_lib');

const PAIS = 'BR';

const IMG = 'https://image.tmdb.org/t/p/w342';
const poster = p => (p ? IMG + p : null);
const ano = x => (x.first_air_date || x.release_date || '').slice(0, 4);

// Aceita a chave em qualquer uma das duas variáveis: o tipo é detectado pelo formato.
// v4 (token de leitura) é um JWT longo "eyJ..."; v3 (chave de API) tem 32 caracteres hexadecimais.
const limpa = v => String(v || '').trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').trim();
function credencial() {
  for (const v of [process.env.TMDB_READ_TOKEN, process.env.TMDB_API_KEY].map(limpa).filter(Boolean)) {
    if (/^eyJ/.test(v) || v.length > 60) return { token: v };
    return { chave: v };
  }
  return null;
}

async function chamar(path, params = {}) {
  const cred = credencial();
  if (!cred) throw erro('TMDb não configurado no servidor (defina TMDB_READ_TOKEN ou TMDB_API_KEY).', 500);
  const { token, chave } = cred;
  const u = new URL('https://api.themoviedb.org/3' + path);
  u.searchParams.set('language', 'pt-BR');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (!token) u.searchParams.set('api_key', chave);
  let r;
  try { r = await fetch(u, { headers: token ? { Authorization: 'Bearer ' + token } : {}, signal: AbortSignal.timeout(8000) }); }
  catch (e) { throw erro('Não foi possível falar com o TMDb.', 502); }
  if (!r.ok) throw erro(r.status === 401 ? 'O TMDb recusou a chave. Em TMDB_READ_TOKEN use o "Token de Leitura da API" (começa com eyJ) ou, em TMDB_API_KEY, a "Chave da API" de 32 caracteres, sem aspas ou espaços.' : 'Não foi possível falar com o TMDb.', 502);
  return r.json();
}

// Dados do TMDb mudam pouco: cache de 24 h na Vercel e 1 h no navegador (só em respostas bem-sucedidas).
const cache = (res, json) => { res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'); return res.json(json); };

module.exports = rota('GET', async (req, res) => {
  const { acao, tipo, q, id } = req.query;
  if (!['tv', 'movie'].includes(tipo)) throw erro('Tipo inválido');
  if (acao === 'busca') {
    const t = String(q || '').trim().slice(0, 100);
    if (!t) throw erro('Digite um nome para buscar');
    const d = await chamar('/search/' + tipo, { query: t });
    return cache(res, { resultados: d.results.slice(0, 6).map(x => ({ id: x.id, nome: x.name || x.title, ano: ano(x), poster: poster(x.poster_path) })) });
  }
  if (acao === 'detalhe' && /^\d{1,9}$/.test(String(id || ''))) {
    const d = await chamar('/' + tipo + '/' + id);
    return cache(res, {
      tmdb: d.id, nome: d.name || d.title, ano: ano(d), sinopse: d.overview || '', poster: poster(d.poster_path),
      nota: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
      duracao: d.runtime || (d.episode_run_time || [])[0] || (d.last_episode_to_air && d.last_episode_to_air.runtime) || null,
      eps: (d.seasons || []).filter(s => s.season_number > 0 && s.episode_count > 0).map(s => s.episode_count),
    });
  }
  // Onde assistir (dados de streaming do TMDb, fornecidos pelo JustWatch)
  if (acao === 'streaming' && /^\d{1,9}$/.test(String(id || ''))) {
    const d = await chamar('/' + tipo + '/' + id + '/watch/providers');
    const r = (d.results || {})[PAIS] || {};
    const lista = a => (a || []).slice(0, 12).map(p => ({ nome: p.provider_name, logo: p.logo_path ? 'https://image.tmdb.org/t/p/w92' + p.logo_path : null }));
    return cache(res, { pais: PAIS, link: r.link || null, assinatura: lista(r.flatrate), gratis: lista(r.free), alugar: lista(r.rent), comprar: lista(r.buy) });
  }
  throw erro('Ação inválida');
});
