// Radar de afinidade: cruza o que a pessoa já viu e avaliou (as "sementes") com títulos candidatos do TMDb.
// Sem rede nem banco: recebe dados já buscados e devolve o DNA (o que se repete nas sementes) e os candidatos
// ordenados, cada um com os motivos ("mesmo diretor", "com o ator X", "mesmo gênero"...). Fácil de testar.

const PAPEL_PESO = { dir: 4, ator: 2, rec: 3, genero: 0.6 };

// Pessoas e gêneros de um título do TMDb já com `credits` anexado.
// Séries: criadores (created_by) fazem o papel de diretor; filmes: diretores da equipe.
function perfilDe(d) {
  const credits = d.credits || {};
  const dirs = new Map(),
    atores = new Map();
  const add = (m, p) => p && p.id && p.name && m.set(p.id, p.name);
  if (Array.isArray(d.created_by)) d.created_by.forEach(p => add(dirs, p));
  for (const p of credits.crew || []) if (p.job === 'Director') add(dirs, p);
  for (const p of (credits.cast || []).slice(0, 5)) add(atores, p);
  const generos = new Map((d.genres || []).map(g => [g.id, g.name]));
  return { dirs, atores, generos };
}

// sementes: [{ id, nome, peso, perfil }]; devolve o que se repete entre elas.
function dnaDe(sementes) {
  const conta = (campo, minimo) => {
    const m = new Map();
    for (const s of sementes)
      for (const [id, nome] of s.perfil[campo]) {
        const x = m.get(id) || { nome, n: 0, peso: 0 };
        x.n++;
        x.peso += s.peso;
        m.set(id, x);
      }
    return [...m.values()]
      .filter(x => x.n >= minimo)
      .sort((a, b) => b.n - a.n || b.peso - a.peso)
      .slice(0, 3)
      .map(({ nome, n }) => ({ nome, n }));
  };
  return { diretores: conta('dirs', 2), atores: conta('atores', 2), generos: conta('generos', 2) };
}

// candidatos: [{ resumo, perfil, recomendadoPor: [idSemente] }]
function pontuar(sementes, candidatos) {
  return candidatos
    .map(c => {
      const porque = [];
      let pontos = 0;
      for (const s of sementes) {
        const base = s.peso;
        const dir = [...c.perfil.dirs].find(([id]) => s.perfil.dirs.has(id));
        const ator = [...c.perfil.atores].find(([id]) => s.perfil.atores.has(id));
        const gen = [...c.perfil.generos].filter(([id]) => s.perfil.generos.has(id)).map(([, n]) => n);
        if (dir) {
          pontos += PAPEL_PESO.dir * base;
          porque.push({ tipo: 'dir', seed: s.id, nome: dir[1] });
        }
        if (ator) {
          pontos += PAPEL_PESO.ator * base;
          porque.push({ tipo: 'ator', seed: s.id, nome: ator[1] });
        }
        if (c.recomendadoPor.includes(s.id)) {
          pontos += PAPEL_PESO.rec * base;
          porque.push({ tipo: 'rec', seed: s.id });
        }
        if (gen.length >= 2) {
          pontos += PAPEL_PESO.genero * gen.length * base;
          porque.push({ tipo: 'genero', seed: s.id, nome: gen.slice(0, 2).join(' e ') });
        }
      }
      // Um motivo por semente (o mais forte), no máximo 2 motivos no total: o app mostra uma frase só.
      const ordem = ['dir', 'ator', 'rec', 'genero'];
      porque.sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo));
      const vistas = new Set(),
        unicos = [];
      for (const p of porque) {
        if (vistas.has(p.seed)) continue;
        vistas.add(p.seed);
        unicos.push(p);
      }
      return { ...c.resumo, onde: c.onde || [], porque: unicos.slice(0, 2), pontos };
    })
    .filter(c => c.porque.length)
    .sort((a, b) => b.pontos - a.pontos)
    .map(({ pontos, ...x }) => x);
}

// Dos dados do TMDb de "onde assistir" (watch/providers) fica só o atalho: até 2 serviços de assinatura/grátis.
function ondeCurto(d, pais = 'BR') {
  const r = ((d['watch/providers'] || {}).results || {})[pais] || {};
  return [...(r.flatrate || []), ...(r.free || [])]
    .map(p => p.provider_name)
    .filter(Boolean)
    .slice(0, 2);
}

module.exports = { perfilDe, dnaDe, pontuar, ondeCurto };
