const { db, rota, erro } = require('./_lib');
const L = require('./_limite');
const { chamar, detalhe } = require('./_tmdb');
const V = require('./_validar');
const { normaliza } = require('./_texto');

const MAX = 10; // itens por requisição
const LOTES_POR_HORA = 400; // por conta: 400 lotes = até 4000 itens por hora (cada item pode custar 1 a 3 chamadas ao TMDb)

// Descobre o id do TMDb de um item vindo de outro serviço: id do TMDb > id do IMDb > nome (e ano).
async function resolverId(tipo, it) {
  if (it.tmdb) return it.tmdb;
  if (it.imdb) {
    const r = await chamar('/find/' + it.imdb, { external_source: 'imdb_id' });
    const x = (r[tipo === 'tv' ? 'tv_results' : 'movie_results'] || [])[0];
    if (x) return x.id;
  }
  if (!it.nome) return null;
  const params = { query: it.nome };
  if (it.ano) params[tipo === 'tv' ? 'first_air_date_year' : 'year'] = it.ano;
  let lista = (await chamar('/search/' + tipo, params)).results || [];
  if (!lista.length && it.ano) lista = (await chamar('/search/' + tipo, { query: it.nome })).results || []; // ano pode estar um pouco errado
  const alvo = normaliza(it.nome);
  const ano = x => Number(String(x.first_air_date || x.release_date || '').slice(0, 4)) || 0;
  const melhor =
    lista.find(x => normaliza(x.name || x.title) === alvo && (!it.ano || Math.abs(ano(x) - it.ano) <= 1)) ||
    lista.find(x => !it.ano || Math.abs(ano(x) - it.ano) <= 1);
  return melhor ? melhor.id : null;
}

// Recebe até 10 itens de uma importação (Trakt, Letterboxd, IMDb) e devolve os dados completos do TMDb de cada um, na mesma ordem.
module.exports = rota('POST', async (req, res, u) => {
  const itens = Array.isArray((req.body || {}).itens) ? req.body.itens.slice(0, MAX) : [];
  if (!itens.length) throw erro('Nada para importar');
  const sql = db(),
    lim = [L.janela('im', u.id, LOTES_POR_HORA, 36e5)]; // janela fixa de 1 h por conta
  await L.verificar(sql, lim);
  await L.registrarFalha(sql, lim); // todo lote conta
  const resultados = await Promise.all(
    itens.map(async raw => {
      try {
        const tipo = raw && raw.tipo === 'movie' ? 'movie' : 'tv';
        const it = {
          tmdb: /^\d{1,9}$/.test(String(raw.tmdb || '')) ? String(raw.tmdb) : null,
          imdb: /^tt\d{5,10}$/.test(String(raw.imdb || '')) ? raw.imdb : null,
          nome: V.txt(raw.nome, 120),
          ano: /^\d{4}$/.test(String(raw.ano || '')) ? Number(raw.ano) : null,
        };
        const id = await resolverId(tipo, it);
        if (!id) return { ok: false, erro: 'Não encontrado no TMDb' };
        return { ok: true, tipo, ...(await detalhe(tipo, id)) };
      } catch (e) {
        return { ok: false, erro: e.expose ? e.message : 'Falha ao consultar o TMDb' };
      }
    }),
  );
  res.json({ resultados });
});
