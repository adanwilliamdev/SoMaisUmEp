const test = require('node:test');
const assert = require('node:assert/strict');

const R = () => import('../public/js/regras.js');
const serie = (o = {}) => ({ id: 'a', tipo: 'tv', nome: 'Série', eps: [10, 8], vis: [0, 0], criado: 1, ...o });

test('estado e próximo episódio', async () => {
  const { estado, prox, rotulo, pct } = await R();
  assert.equal(estado(serie()), 'quero');
  assert.equal(estado(serie({ vis: [3, 0] })), 'assistindo');
  assert.equal(estado(serie({ vis: [10, 8] })), 'fim');
  assert.deepEqual(prox(serie({ vis: [10, 2] })), [2, 3]);
  assert.deepEqual(prox(serie({ vis: [3, 0] })), [1, 4]);
  assert.equal(prox(serie({ vis: [10, 8] })), null);
  assert.equal(rotulo(serie({ vis: [10, 2] })), 'Próximo: T2 · E3');
  assert.equal(rotulo(serie({ vis: [10, 8] })), 'Concluída ✓');
  assert.equal(pct(serie({ vis: [9, 0] })), 50);
});

test('filmes: assistido ou na fila', async () => {
  const { estado, rotulo } = await R();
  const f = { id: 'f', tipo: 'movie', nome: 'Filme', eps: [1], vis: [0] };
  assert.equal(rotulo(f), 'Na fila');
  assert.equal(estado({ ...f, vis: [1] }), 'fim');
  assert.equal(rotulo({ ...f, vis: [1] }), 'Assistido ✓');
});

test('busca ignora acento e maiúsculas, e combina com o filtro de estado', async () => {
  const { filtrar } = await R();
  const L = [serie({ id: '1', nome: 'Coração de Ferro' }), serie({ id: '2', nome: 'Breaking Bad', vis: [2, 0] })];
  assert.deepEqual(filtrar(L, { busca: 'coracao' }).map(s => s.id), ['1']);
  assert.deepEqual(filtrar(L, { busca: 'BREAK' }).map(s => s.id), ['2']);
  assert.deepEqual(filtrar(L, { estado: 'assistindo' }).map(s => s.id), ['2']);
  assert.deepEqual(filtrar(L, { estado: 'assistindo', busca: 'ferro' }), []);
});

test('ordenação por nome, nota e último visto', async () => {
  const { ordenar } = await R();
  const L = [
    serie({ id: 'b', nome: 'Beta', nota: 7, visto_em: 100, criado: 1 }),
    serie({ id: 'a', nome: 'álgebra', nota: 9, visto_em: null, criado: 2 }),
    serie({ id: 'c', nome: 'Céu', nota: 5, nota_pessoal: 10, visto_em: 300, criado: 3 }),
  ];
  assert.deepEqual(ordenar(L, 'nome').map(s => s.id), ['a', 'b', 'c']);
  assert.deepEqual(ordenar(L, 'nota').map(s => s.id), ['c', 'a', 'b']); // nota pessoal vence a do TMDb
  assert.deepEqual(ordenar(L, 'visto').map(s => s.id), ['c', 'b', 'a']);
  assert.deepEqual(ordenar(L, 'recente').map(s => s.id), ['c', 'a', 'b']);
});

test('"Continuar assistindo": só séries em andamento, mais recentes primeiro', async () => {
  const { continuar } = await R();
  const L = [
    serie({ id: '1', vis: [2, 0], visto_em: 10 }),
    serie({ id: '2', vis: [2, 0], visto_em: 50 }),
    serie({ id: '3', vis: [0, 0] }),
    serie({ id: '4', vis: [10, 8] }),
    { id: '5', tipo: 'movie', nome: 'F', eps: [1], vis: [0] },
  ];
  assert.deepEqual(continuar(L).map(s => s.id), ['2', '1']);
});

test('registrarProgresso soma no mês e atualiza "último visto"', async () => {
  const { registrarProgresso, vis } = await R();
  const agora = new Date(2026, 10, 5, 12).getTime();
  const s = serie({ vis: [2, 0] });
  const antes = vis(s); s.vis[0] = 5;
  registrarProgresso(s, antes, agora);
  assert.deepEqual(s.hist, { '2026-11': 3 });
  assert.equal(s.visto_em, agora);
  const a2 = vis(s); s.vis[0] = 4;               // desmarcar
  registrarProgresso(s, a2, agora + 1);
  assert.deepEqual(s.hist, { '2026-11': 2 });
  assert.equal(s.visto_em, agora);               // desmarcar não muda o último visto
  const a3 = vis(s); s.vis[0] = 2;
  registrarProgresso(s, a3, agora + 2);
  assert.equal(s.hist['2026-11'], undefined);    // chega a zero: some do histórico
});

test('temporadas novas: cresce sem perder progresso nem diminuir', async () => {
  const { aplicarEps, fundirEps } = await R();
  const s = serie({ eps: [10, 8], vis: [10, 8] });
  assert.equal(aplicarEps(s, [10, 8, 6]), true);
  assert.deepEqual(s.eps, [10, 8, 6]);
  assert.deepEqual(s.vis, [10, 8, 0]);
  assert.equal(aplicarEps(s, [10, 8, 6]), false);               // nada novo
  assert.equal(aplicarEps(s, [10]), false);                      // TMDb com menos: ignora
  assert.deepEqual(s.eps, [10, 8, 6]);
  assert.deepEqual(fundirEps([10, 8], [12, 8]), [12, 8]);        // episódio novo na T1
});

test('mesclar: progresso não regride e o servidor vence nos metadados', async () => {
  const { mesclarTitulo } = await R();
  const loc = serie({ vis: [5, 0], nome: 'Local', visto_em: 20, hist: { '2026-11': 5 } });
  const srv = serie({ vis: [3, 2], nome: 'Servidor', visto_em: 30, hist: { '2026-11': 2, '2026-10': 4 } });
  const m = mesclarTitulo(loc, srv);
  assert.deepEqual(m.vis, [5, 2]);
  assert.equal(m.nome, 'Servidor');
  assert.equal(m.visto_em, 30);
  assert.deepEqual(m.hist, { '2026-11': 5, '2026-10': 4 });
  const srv2 = serie({ eps: [10, 8, 4], vis: [1, 1, 1] });      // temporadas diferentes: servidor vence
  assert.deepEqual(mesclarTitulo(loc, srv2).vis, [1, 1, 1]);
  assert.equal(mesclarTitulo(loc, null), loc);
});

test('estatísticas: tempo, contagens e meses', async () => {
  const { estatisticas, ultimosMeses, duracaoTexto } = await R();
  const L = [
    serie({ id: '1', vis: [10, 8], duracao: 50, nota_pessoal: 9, hist: { '2026-10': 18 } }),
    serie({ id: '2', vis: [2, 0] }),                                   // sem duração
    { id: '3', tipo: 'movie', nome: 'F', eps: [1], vis: [1], duracao: 120, nota_pessoal: 8, hist: { '2026-11': 1 } },
  ];
  const r = estatisticas(L);
  assert.equal(r.episodios, 20);
  assert.equal(r.filmes, 1);
  assert.equal(r.concluidas, 1);
  assert.equal(r.minutos, 18 * 50 + 120);
  assert.equal(r.semDuracao, 1);
  assert.equal(r.notaMedia, 8.5);
  assert.deepEqual(r.porMes, { '2026-10': 18, '2026-11': 1 });
  const m = ultimosMeses(r.porMes, 3, new Date(2026, 10, 15).getTime());
  assert.deepEqual(m.map(x => [x.mes, x.valor]), [['2026-09', 0], ['2026-10', 18], ['2026-11', 1]]);
  assert.equal(duracaoTexto(90), '1 h 30 min');
  assert.equal(duracaoTexto(45), '45 min');
});
