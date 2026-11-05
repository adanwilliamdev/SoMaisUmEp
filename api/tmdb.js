const { rota, erro } = require('./_lib');
const { poster, ano, chamar, resumo, detalhe } = require('./_tmdb');

const PAIS = 'BR';

// Dados do TMDb mudam pouco: cache na Vercel (24 h por padrão) e 1 h no navegador (só em respostas bem-sucedidas).
const cache = (res, json, seg = 86400) => { res.setHeader('Cache-Control', `public, max-age=3600, s-maxage=${seg}, stale-while-revalidate=604800`); return res.json(json); };

const IDS = /^\d{1,9}$/;

module.exports = rota('GET', async (req, res) => {
  const { acao, tipo, q, id, ids } = req.query;
  if (!['tv', 'movie'].includes(tipo)) throw erro('Tipo inválido');
  if (acao === 'busca') {
    const t = String(q || '').trim().slice(0, 100);
    if (!t) throw erro('Digite um nome para buscar');
    const d = await chamar('/search/' + tipo, { query: t });
    return cache(res, { resultados: d.results.slice(0, 6).map(x => ({ id: x.id, nome: x.name || x.title, ano: ano(x), poster: poster(x.poster_path) })) });
  }
  if (acao === 'detalhe' && IDS.test(String(id || ''))) {
    // Séries: 6 h, para a data do próximo episódio não ficar velha.
    return cache(res, await detalhe(tipo, id), tipo === 'tv' ? 21600 : 86400);
  }
  // Onde assistir (dados de streaming do TMDb, fornecidos pelo JustWatch)
  if (acao === 'streaming' && IDS.test(String(id || ''))) {
    const d = await chamar('/' + tipo + '/' + id + '/watch/providers');
    const r = (d.results || {})[PAIS] || {};
    const lista = a => (a || []).slice(0, 12).map(p => ({ nome: p.provider_name, logo: p.logo_path ? 'https://image.tmdb.org/t/p/w92' + p.logo_path : null }));
    return cache(res, { pais: PAIS, link: r.link || null, assinatura: lista(r.flatrate), gratis: lista(r.free), alugar: lista(r.rent), comprar: lista(r.buy) });
  }
  // Descobrir: o que está em alta na semana
  if (acao === 'tendencias') {
    const d = await chamar('/trending/' + tipo + '/week');
    return cache(res, { resultados: (d.results || []).slice(0, 18).map(resumo) }, 21600);
  }
  // Descobrir: parecidos com os títulos (ids do TMDb, até 5) que a pessoa já viu. Mais indicações = mais acima.
  if (acao === 'parecidos') {
    const lista = [...new Set(String(ids || '').split(',').filter(i => IDS.test(i)))].slice(0, 5);
    if (!lista.length) throw erro('Informe títulos do TMDb');
    const rs = await Promise.allSettled(lista.map(i => chamar('/' + tipo + '/' + i + '/recommendations')));
    if (rs.every(r => r.status === 'rejected')) throw erro('Não foi possível falar com o TMDb.', 502);
    const todos = new Map();
    rs.forEach((r, k) => {
      if (r.status !== 'fulfilled') return;
      for (const x of (r.value.results || []).slice(0, 20)) {
        if (lista.includes(String(x.id))) continue;                       // o próprio título de origem
        const it = todos.get(x.id) || { ...resumo(x), porque: [], pop: x.popularity || 0 };
        it.porque.push(Number(lista[k])); todos.set(x.id, it);
      }
    });
    const saida = [...todos.values()].sort((a, b) => b.porque.length - a.porque.length || b.pop - a.pop).slice(0, 18).map(({ pop, ...x }) => x);
    return cache(res, { resultados: saida }, 21600);
  }
  throw erro('Ação inválida');
});
