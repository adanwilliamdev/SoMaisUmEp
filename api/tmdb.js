const { rota, erro } = require('./_lib');

const IMG = 'https://image.tmdb.org/t/p/w342';
const poster = p => (p ? IMG + p : null);
const ano = x => (x.first_air_date || x.release_date || '').slice(0, 4);

async function chamar(path, params = {}) {
  const token = process.env.TMDB_READ_TOKEN, chave = process.env.TMDB_API_KEY;
  if (!token && !chave) throw erro('TMDb não configurado no servidor (defina TMDB_READ_TOKEN ou TMDB_API_KEY).', 500);
  const u = new URL('https://api.themoviedb.org/3' + path);
  u.searchParams.set('language', 'pt-BR');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (!token) u.searchParams.set('api_key', chave);
  let r;
  try { r = await fetch(u, { headers: token ? { Authorization: 'Bearer ' + token } : {}, signal: AbortSignal.timeout(8000) }); }
  catch (e) { throw erro('Não foi possível falar com o TMDb.', 502); }
  if (!r.ok) throw erro(r.status === 401 ? 'Chave do TMDb inválida.' : 'Não foi possível falar com o TMDb.', 502);
  return r.json();
}

module.exports = rota('GET', async (req, res) => {
  const { acao, tipo, q, id } = req.query;
  if (!['tv', 'movie'].includes(tipo)) throw erro('Tipo inválido');
  if (acao === 'busca') {
    const t = String(q || '').trim().slice(0, 100);
    if (!t) throw erro('Digite um nome para buscar');
    const d = await chamar('/search/' + tipo, { query: t });
    return res.json({ resultados: d.results.slice(0, 6).map(x => ({ id: x.id, nome: x.name || x.title, ano: ano(x), poster: poster(x.poster_path) })) });
  }
  if (acao === 'detalhe' && /^\d{1,9}$/.test(String(id || ''))) {
    const d = await chamar('/' + tipo + '/' + id);
    return res.json({
      tmdb: d.id, nome: d.name || d.title, ano: ano(d), sinopse: d.overview || '', poster: poster(d.poster_path),
      nota: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null, duracao: d.runtime || null,
      eps: (d.seasons || []).filter(s => s.season_number > 0 && s.episode_count > 0).map(s => s.episode_count),
    });
  }
  throw erro('Ação inválida');
});
