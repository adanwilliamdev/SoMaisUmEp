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

test('duplicados: mesmo TMDb ou mesmo nome (sem acento/caixa) no mesmo tipo', async () => {
  const { mesmoTitulo, acharDuplicado } = await R();
  const a = serie({ id: '1', nome: 'Coração de Ferro', tmdb: 10, ano: '2020' });
  assert.ok(mesmoTitulo(a, serie({ id: '2', nome: 'qualquer outro nome', tmdb: 10 })));          // mesmo TMDb
  assert.ok(mesmoTitulo(a, serie({ id: '2', nome: '  CORACAO  de   ferro ', tmdb: undefined })));  // mesmo nome
  assert.ok(!mesmoTitulo(a, serie({ id: '2', nome: 'Coração de Ferro', tmdb: 11 })));            // TMDb diferente
  assert.ok(!mesmoTitulo(a, serie({ id: '2', nome: 'Coração de Ferro', ano: '1990' })));         // remake: anos diferentes
  assert.ok(!mesmoTitulo(a, { ...serie({ id: '2', nome: 'Coração de Ferro' }), tipo: 'movie' })); // filme x série
  assert.equal(acharDuplicado([a], serie({ id: '9', nome: 'coracao de ferro' })).id, '1');
  assert.equal(acharDuplicado([a], serie({ id: '1', nome: 'Coração de Ferro' }), '1'), null);    // editando o próprio item
});

test('importar: ignora títulos que já existem e repetidos dentro do arquivo', async () => {
  const { semDuplicados } = await R();
  const atuais = [serie({ id: '1', nome: 'Dune', tmdb: 5 })];
  const novos = [serie({ id: 'x', nome: 'Dune', tmdb: 5 }), serie({ id: 'y', nome: 'Alien' }), serie({ id: 'z', nome: 'alien' }), serie({ id: '1', nome: 'Dune', tmdb: 5 })];
  const { aceitos, repetidos } = semDuplicados(novos, atuais);
  assert.deepEqual(aceitos.map(s => s.id), ['y', '1']);   // mesmo id = atualização do item existente, continua valendo
  assert.deepEqual(repetidos.map(s => s.id), ['x', 'z']);
});

/* ---------- v5.1: lançamentos e descobrir ---------- */
// 2026-11-04 (quarta) ao meio-dia, no fuso local
const AGORA = new Date(2026, 10, 4, 12).getTime();

test('lançamento: hoje, amanhã, dia da semana e data; passado some', async () => {
  const { lancamento } = await R();
  const com = (d, extra = {}) => serie({ proximo: { d, t: 3, e: 5, ...extra } });
  assert.equal(lancamento(com('2026-11-04'), AGORA).texto, 'Novo ep hoje');
  assert.equal(lancamento(com('2026-11-04'), AGORA).hoje, true);
  assert.equal(lancamento(com('2026-11-05'), AGORA).texto, 'Novo ep amanhã');
  assert.equal(lancamento(com('2026-11-06'), AGORA).texto, 'Novo ep sexta');       // 6 nov 2026 é sexta
  assert.equal(lancamento(com('2026-11-12'), AGORA).texto, 'Novo ep em 12 nov');
  assert.equal(lancamento(com('2026-11-03'), AGORA), null);
  assert.equal(lancamento(serie(), AGORA), null);
  assert.equal(lancamento(com('lixo'), AGORA), null);
});

test('lançamento: estreia de temporada e de filme', async () => {
  const { lancamento } = await R();
  assert.equal(lancamento(serie({ proximo: { d: '2026-11-06', t: 3, e: 1 } }), AGORA).texto, 'Nova temporada sexta');
  assert.equal(lancamento(serie({ proximo: { d: '2026-11-06', t: 1, e: 1 } }), AGORA).texto, 'Novo ep sexta');           // estreia da série
  assert.equal(lancamento({ id: 'f', tipo: 'movie', nome: 'F', eps: [1], vis: [0], proximo: { d: '2026-12-25' } }, AGORA).texto, 'Estreia em 25 dez');
});

test('próximos lançamentos: ordem, filtro por tipo e janela de dias', async () => {
  const { proximosLancamentos, lancamentoVencido } = await R();
  const lista = [
    serie({ id: 'a', nome: 'B', proximo: { d: '2026-11-10' } }), serie({ id: 'b', nome: 'A', proximo: { d: '2026-11-04' } }),
    serie({ id: 'c', nome: 'C', proximo: { d: '2027-03-01' } }), serie({ id: 'd', nome: 'D' }),
    { id: 'f', tipo: 'movie', nome: 'F', eps: [1], vis: [0], proximo: { d: '2026-11-07' } },
  ];
  assert.deepEqual(proximosLancamentos(lista, { tipo: 'tv', agora: AGORA }).map(x => x.s.id), ['b', 'a']);
  assert.deepEqual(proximosLancamentos(lista, { tipo: 'movie', agora: AGORA }).map(x => x.s.id), ['f']);
  assert.deepEqual(proximosLancamentos(lista, { agora: AGORA, dias: 0 }).map(x => x.s.id), ['b']);
  assert.equal(lancamentoVencido(lista[1], AGORA), true);
  assert.equal(lancamentoVencido(lista[0], AGORA), false);
  assert.equal(lancamentoVencido(lista[3], AGORA), false);
});

test('sementes: só começados, com TMDb e sem nota baixa; melhor nota primeiro', async () => {
  const { sementes, naEstante } = await R();
  const l = [
    serie({ id: '1', tmdb: 1, vis: [1, 0], nota_pessoal: 9, visto_em: 5 }), serie({ id: '2', tmdb: 2, vis: [1, 0], visto_em: 50 }),
    serie({ id: '3', tmdb: 3, vis: [1, 0], nota_pessoal: 3 }), serie({ id: '4', tmdb: 4 }), serie({ id: '5', vis: [2, 0] }),
    { id: '6', tipo: 'movie', nome: 'F', eps: [1], vis: [1], tmdb: 6 },
  ];
  assert.deepEqual(sementes(l, 'tv').map(s => s.id), ['1', '2']);
  assert.deepEqual(sementes(l, 'movie').map(s => s.id), ['6']);
  assert.equal(naEstante(l, 'tv', 2), true);
  assert.equal(naEstante(l, 'movie', 2), false);
});
