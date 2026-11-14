const { erro } = require('./_lib');
const { poster, ano, chamar, resumo, detalhe } = require('./_tmdb');
const { perfilDe, dnaDe, pontuar, ondeCurto } = require('./_afinidade');

const PAIS = 'BR';

// Dados do TMDb mudam pouco: cache na Vercel (24 h por padrão) e 1 h no navegador (só em respostas bem-sucedidas).
const cache = (res, json, seg = 86400, navegador = 3600, velha = 604800) => {
  res.setHeader('Cache-Control', `public, max-age=${navegador}, s-maxage=${seg}, stale-while-revalidate=${velha}`);
  return res.json(json);
};

const IDS = /^\d{1,9}$/;
const SEMENTE = /^\d{1,9}(:\d{1,2}(\.\d)?)?$/; // "id" ou "id:nota"

// Consultas ao TMDb (GET /api/tmdb?acao=...). Cada uma recebe (req, res, tipo) e responde com cache.
const consultas = {
  async busca(req, res, tipo) {
    const t = String(req.query.q || '')
      .trim()
      .slice(0, 100);
    if (!t) throw erro('Digite um nome para buscar');
    const d = await chamar('/search/' + tipo, { query: t });
    return cache(res, { resultados: d.results.slice(0, 6).map(x => ({ id: x.id, nome: x.name || x.title, ano: ano(x), poster: poster(x.poster_path) })) });
  },

  async detalhe(req, res, tipo) {
    const { id } = req.query;
    if (!IDS.test(String(id || ''))) throw erro('Ação inválida');
    // Séries: 6 h, para a data do próximo episódio não ficar velha.
    return cache(res, await detalhe(tipo, id), tipo === 'tv' ? 21600 : 86400);
  },

  // Onde assistir (dados de streaming do TMDb, fornecidos pelo JustWatch)
  async streaming(req, res, tipo) {
    const { id } = req.query;
    if (!IDS.test(String(id || ''))) throw erro('Ação inválida');
    const d = await chamar('/' + tipo + '/' + id + '/watch/providers');
    const r = (d.results || {})[PAIS] || {};
    const lista = a => (a || []).slice(0, 12).map(p => ({ nome: p.provider_name, logo: p.logo_path ? 'https://image.tmdb.org/t/p/w92' + p.logo_path : null }));
    return cache(res, { pais: PAIS, link: r.link || null, assinatura: lista(r.flatrate), gratis: lista(r.free), alugar: lista(r.rent), comprar: lista(r.buy) });
  },

  // Descobrir: o que está em alta na semana
  async tendencias(req, res, tipo) {
    const d = await chamar('/trending/' + tipo + '/week');
    return cache(res, { resultados: (d.results || []).slice(0, 18).map(resumo) }, 21600);
  },

  // Descobrir: parecidos com os títulos (ids do TMDb, até 5) que a pessoa já viu. Mais indicações = mais acima.
  async parecidos(req, res, tipo) {
    const lista = [
      ...new Set(
        String(req.query.ids || '')
          .split(',')
          .filter(i => IDS.test(i)),
      ),
    ].slice(0, 5);
    if (!lista.length) throw erro('Informe títulos do TMDb');
    const rs = await Promise.allSettled(lista.map(i => chamar('/' + tipo + '/' + i + '/recommendations')));
    if (rs.every(r => r.status === 'rejected')) throw erro('Não foi possível falar com o TMDb.', 502);
    const todos = new Map();
    rs.forEach((r, k) => {
      if (r.status !== 'fulfilled') return;
      for (const x of (r.value.results || []).slice(0, 20)) {
        if (lista.includes(String(x.id))) continue; // o próprio título de origem
        const it = todos.get(x.id) || { ...resumo(x), porque: [], pop: x.popularity || 0 };
        it.porque.push(Number(lista[k]));
        todos.set(x.id, it);
      }
    });
    const saida = [...todos.values()]
      .sort((a, b) => b.porque.length - a.porque.length || b.pop - a.pop)
      .slice(0, 18)
      .map(({ pop, ...x }) => x);
    return cache(res, { resultados: saida }, 21600);
  },

  // Descobrir (radar de afinidade): ids = títulos que a pessoa está vendo/viu, no formato "id" ou "id:nota" (nota pessoal 0-10).
  // Devolve o DNA (diretores, atores e gêneros que se repetem) e candidatos com o motivo de cada um e um atalho de onde assistir.
  // Candidatos vêm de três fontes: recomendações do TMDb, "similares" e uma busca por gênero em lançamentos recentes (o que mantém a lista atual).
  async afinidade(req, res, tipo) {
    const brutos = [...new Set(String(req.query.ids || '').split(','))].filter(i => SEMENTE.test(i)).slice(0, 6);
    const sementes = brutos.map(b => {
      const [id, nota] = b.split(':');
      return { id: Number(id), peso: nota === undefined ? 0.7 : Math.min(1, Math.max(0.1, Number(nota) / 10)) };
    });
    if (!sementes.length) throw erro('Informe títulos do TMDb');
    const anoAtual = new Date().getFullYear();
    const dets = await Promise.allSettled(
      sementes.map(s => chamar('/' + tipo + '/' + s.id, { append_to_response: 'credits,recommendations,similar,keywords' })),
    );
    if (dets.every(r => r.status === 'rejected')) throw erro('Não foi possível falar com o TMDb.', 502);
    const boas = [],
      cands = new Map();
    const entra = (x, semente, origem) => {
      if (sementes.some(y => y.id === x.id)) return;
      const c = cands.get(x.id) || { resumo: resumo(x), recomendadoPor: [], pop: x.popularity || 0, origem };
      if (semente && !c.recomendadoPor.includes(semente)) c.recomendadoPor.push(semente);
      cands.set(x.id, c);
    };
    dets.forEach((r, k) => {
      if (r.status !== 'fulfilled') return;
      const s = { ...sementes[k], perfil: perfilDe(r.value) };
      boas.push(s);
      for (const x of ((r.value.recommendations || {}).results || []).slice(0, 20)) entra(x, s.id, 'rec');
      for (const x of ((r.value.similar || {}).results || []).slice(0, 10)) entra(x, s.id, 'rec');
    });
    // Lançamentos recentes nos dois gêneros mais frequentes das sementes (se falhar, o radar segue só com as indicações).
    const porGenero = new Map();
    for (const s of boas) for (const [id] of s.perfil.generos) porGenero.set(id, (porGenero.get(id) || 0) + s.peso);
    const topoGen = [...porGenero.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id]) => id);
    let novos = [];
    if (topoGen.length) {
      const desde = `${anoAtual - 1}-01-01`;
      try {
        const d = await chamar('/discover/' + tipo, {
          with_genres: topoGen.join(','),
          sort_by: 'popularity.desc',
          'vote_count.gte': 30,
          'vote_average.gte': 6.5,
          [tipo === 'tv' ? 'first_air_date.gte' : 'primary_release_date.gte']: desde,
        });
        novos = (d.results || []).slice(0, 12);
      } catch (e) {
        novos = [];
      }
    }
    const antes = new Set(cands.keys());
    for (const x of novos) entra(x, null, 'novo');
    // Só os mais promissores ganham a segunda chamada (elenco, direção, palavras-chave e onde assistir vêm juntos).
    const ordena = (a, b) => b.recomendadoPor.length - a.recomendadoPor.length || b.pop - a.pop;
    const todos = [...cands.entries()];
    const finalistas = [
      ...todos
        .filter(([id]) => antes.has(id))
        .map(([, c]) => c)
        .sort(ordena)
        .slice(0, 12),
      ...todos
        .filter(([id]) => !antes.has(id))
        .map(([, c]) => c)
        .sort(ordena)
        .slice(0, 6),
    ];
    const ext = await Promise.allSettled(
      finalistas.map(c => chamar('/' + tipo + '/' + c.resumo.id, { append_to_response: 'credits,keywords,watch/providers' })),
    );
    const completos = finalistas.map((c, i) => {
      const d = ext[i].status === 'fulfilled' ? ext[i].value : {};
      return { ...c, perfil: perfilDe(d), onde: ondeCurto(d) };
    });
    // Respostas do radar envelhecem rápido (o que você assistiu hoje muda a lista): 15 min no navegador, 6 h na borda e pouca tolerância a cópia velha.
    return cache(res, { dna: dnaDe(boas), resultados: pontuar(boas, completos, anoAtual).slice(0, 18) }, 21600, 900, 3600);
  },
};

module.exports = { consultas };
