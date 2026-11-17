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
  assert.deepEqual(
    filtrar(L, { busca: 'coracao' }).map(s => s.id),
    ['1'],
  );
  assert.deepEqual(
    filtrar(L, { busca: 'BREAK' }).map(s => s.id),
    ['2'],
  );
  assert.deepEqual(
    filtrar(L, { estado: 'assistindo' }).map(s => s.id),
    ['2'],
  );
  assert.deepEqual(filtrar(L, { estado: 'assistindo', busca: 'ferro' }), []);
});

test('ordenação por nome, nota e último visto', async () => {
  const { ordenar } = await R();
  const L = [
    serie({ id: 'b', nome: 'Beta', nota: 7, visto_em: 100, criado: 1 }),
    serie({ id: 'a', nome: 'álgebra', nota: 9, visto_em: null, criado: 2 }),
    serie({ id: 'c', nome: 'Céu', nota: 5, nota_pessoal: 10, visto_em: 300, criado: 3 }),
  ];
  assert.deepEqual(
    ordenar(L, 'nome').map(s => s.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    ordenar(L, 'nota').map(s => s.id),
    ['c', 'a', 'b'],
  ); // nota pessoal vence a do TMDb
  assert.deepEqual(
    ordenar(L, 'visto').map(s => s.id),
    ['c', 'b', 'a'],
  );
  assert.deepEqual(
    ordenar(L, 'recente').map(s => s.id),
    ['c', 'a', 'b'],
  );
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
  assert.deepEqual(
    continuar(L).map(s => s.id),
    ['2', '1'],
  );
});

test('registrarProgresso soma no mês e atualiza "último visto"', async () => {
  const { registrarProgresso, vis } = await R();
  const agora = new Date(2026, 10, 5, 12).getTime();
  const s = serie({ vis: [2, 0] });
  const antes = vis(s);
  s.vis[0] = 5;
  registrarProgresso(s, antes, agora);
  assert.deepEqual(s.hist, { '2026-11': 3 });
  assert.equal(s.visto_em, agora);
  const a2 = vis(s);
  s.vis[0] = 4; // desmarcar
  registrarProgresso(s, a2, agora + 1);
  assert.deepEqual(s.hist, { '2026-11': 2 });
  assert.equal(s.visto_em, agora); // desmarcar não muda o último visto
  const a3 = vis(s);
  s.vis[0] = 2;
  registrarProgresso(s, a3, agora + 2);
  assert.equal(s.hist['2026-11'], undefined); // chega a zero: some do histórico
});

test('temporadas novas: cresce sem perder progresso nem diminuir', async () => {
  const { aplicarEps, fundirEps } = await R();
  const s = serie({ eps: [10, 8], vis: [10, 8] });
  assert.equal(aplicarEps(s, [10, 8, 6]), true);
  assert.deepEqual(s.eps, [10, 8, 6]);
  assert.deepEqual(s.vis, [10, 8, 0]);
  assert.equal(aplicarEps(s, [10, 8, 6]), false); // nada novo
  assert.equal(aplicarEps(s, [10]), false); // TMDb com menos: ignora
  assert.deepEqual(s.eps, [10, 8, 6]);
  assert.deepEqual(fundirEps([10, 8], [12, 8]), [12, 8]); // episódio novo na T1
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
  const srv2 = serie({ eps: [10, 8, 4], vis: [1, 1, 1] }); // temporadas diferentes: eps do servidor, progresso local preservado
  assert.deepEqual(mesclarTitulo(loc, srv2).vis, [5, 1, 1]);
  assert.equal(mesclarTitulo(loc, null), loc);
});

test('estatísticas: tempo, contagens e meses', async () => {
  const { estatisticas, ultimosMeses, duracaoTexto } = await R();
  const L = [
    serie({ id: '1', vis: [10, 8], duracao: 50, nota_pessoal: 9, hist: { '2026-10': 18 } }),
    serie({ id: '2', vis: [2, 0] }), // sem duração
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
  assert.deepEqual(
    m.map(x => [x.mes, x.valor]),
    [
      ['2026-09', 0],
      ['2026-10', 18],
      ['2026-11', 1],
    ],
  );
  assert.equal(duracaoTexto(90), '1 h 30 min');
  assert.equal(duracaoTexto(45), '45 min');
});

test('duplicados: mesmo TMDb ou mesmo nome (sem acento/caixa) no mesmo tipo', async () => {
  const { mesmoTitulo, acharDuplicado } = await R();
  const a = serie({ id: '1', nome: 'Coração de Ferro', tmdb: 10, ano: '2020' });
  assert.ok(mesmoTitulo(a, serie({ id: '2', nome: 'qualquer outro nome', tmdb: 10 }))); // mesmo TMDb
  assert.ok(mesmoTitulo(a, serie({ id: '2', nome: '  CORACAO  de   ferro ', tmdb: undefined }))); // mesmo nome
  assert.ok(!mesmoTitulo(a, serie({ id: '2', nome: 'Coração de Ferro', tmdb: 11 }))); // TMDb diferente
  assert.ok(!mesmoTitulo(a, serie({ id: '2', nome: 'Coração de Ferro', ano: '1990' }))); // remake: anos diferentes
  assert.ok(!mesmoTitulo(a, { ...serie({ id: '2', nome: 'Coração de Ferro' }), tipo: 'movie' })); // filme x série
  assert.equal(acharDuplicado([a], serie({ id: '9', nome: 'coracao de ferro' })).id, '1');
  assert.equal(acharDuplicado([a], serie({ id: '1', nome: 'Coração de Ferro' }), '1'), null); // editando o próprio item
});

test('importar: ignora títulos que já existem e repetidos dentro do arquivo', async () => {
  const { semDuplicados } = await R();
  const atuais = [serie({ id: '1', nome: 'Dune', tmdb: 5 })];
  const novos = [
    serie({ id: 'x', nome: 'Dune', tmdb: 5 }),
    serie({ id: 'y', nome: 'Alien' }),
    serie({ id: 'z', nome: 'alien' }),
    serie({ id: '1', nome: 'Dune', tmdb: 5 }),
  ];
  const { aceitos, repetidos } = semDuplicados(novos, atuais);
  assert.deepEqual(
    aceitos.map(s => s.id),
    ['y', '1'],
  ); // mesmo id = atualização do item existente, continua valendo
  assert.deepEqual(
    repetidos.map(s => s.id),
    ['x', 'z'],
  );
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
  assert.equal(lancamento(com('2026-11-06'), AGORA).texto, 'Novo ep sexta'); // 6 nov 2026 é sexta
  assert.equal(lancamento(com('2026-11-12'), AGORA).texto, 'Novo ep em 12 nov');
  assert.equal(lancamento(com('2026-11-03'), AGORA), null);
  assert.equal(lancamento(serie(), AGORA), null);
  assert.equal(lancamento(com('lixo'), AGORA), null);
});

test('lançamento: estreia de temporada e de filme', async () => {
  const { lancamento } = await R();
  assert.equal(lancamento(serie({ proximo: { d: '2026-11-06', t: 3, e: 1 } }), AGORA).texto, 'Nova temporada sexta');
  assert.equal(lancamento(serie({ proximo: { d: '2026-11-06', t: 1, e: 1 } }), AGORA).texto, 'Novo ep sexta'); // estreia da série
  assert.equal(lancamento({ id: 'f', tipo: 'movie', nome: 'F', eps: [1], vis: [0], proximo: { d: '2026-12-25' } }, AGORA).texto, 'Estreia em 25 dez');
});

test('próximos lançamentos: ordem, filtro por tipo e janela de dias', async () => {
  const { proximosLancamentos, lancamentoVencido } = await R();
  const lista = [
    serie({ id: 'a', nome: 'B', proximo: { d: '2026-11-10' } }),
    serie({ id: 'b', nome: 'A', proximo: { d: '2026-11-04' } }),
    serie({ id: 'c', nome: 'C', proximo: { d: '2027-03-01' } }),
    serie({ id: 'd', nome: 'D' }),
    { id: 'f', tipo: 'movie', nome: 'F', eps: [1], vis: [0], proximo: { d: '2026-11-07' } },
  ];
  assert.deepEqual(
    proximosLancamentos(lista, { tipo: 'tv', agora: AGORA }).map(x => x.s.id),
    ['b', 'a'],
  );
  assert.deepEqual(
    proximosLancamentos(lista, { tipo: 'movie', agora: AGORA }).map(x => x.s.id),
    ['f'],
  );
  assert.deepEqual(
    proximosLancamentos(lista, { agora: AGORA, dias: 0 }).map(x => x.s.id),
    ['b'],
  );
  assert.equal(lancamentoVencido(lista[1], AGORA), true);
  assert.equal(lancamentoVencido(lista[0], AGORA), false);
  assert.equal(lancamentoVencido(lista[3], AGORA), false);
});

test('sementes: só começados, com TMDb e sem nota baixa; melhor nota primeiro', async () => {
  const { sementes, naEstante } = await R();
  const l = [
    serie({ id: '1', tmdb: 1, vis: [1, 0], nota_pessoal: 9, visto_em: 5 }),
    serie({ id: '2', tmdb: 2, vis: [1, 0], visto_em: 50 }),
    serie({ id: '3', tmdb: 3, vis: [1, 0], nota_pessoal: 3 }),
    serie({ id: '4', tmdb: 4 }),
    serie({ id: '5', vis: [2, 0] }),
    { id: '6', tipo: 'movie', nome: 'F', eps: [1], vis: [1], tmdb: 6 },
  ];
  assert.deepEqual(
    sementes(l, 'tv').map(s => s.id),
    ['1', '2'],
  );
  assert.deepEqual(
    sementes(l, 'movie').map(s => s.id),
    ['6'],
  );
  assert.equal(naEstante(l, 'tv', 2), true);
  assert.equal(naEstante(l, 'movie', 2), false);
});

/* ---------- backup importado: saneamento ---------- */
test('backup: ids, números, capas e textos passam pelo saneamento (nada de aspas em atributos)', async () => {
  const { limparTituloBackup: lt, limparTopBackup: lp, capaSegura } = await R();
  assert.equal(lt({ id: '"><img src=x>', nome: 'X', eps: [1], vis: [0] }), null, 'id com aspas/HTML é descartado');
  assert.equal(lt({ id: 'a'.repeat(65), nome: 'X', eps: [1], vis: [0] }), null);
  assert.equal(lt({ id: 'ok', nome: '  ', eps: [1], vis: [0] }), null, 'sem nome');
  assert.equal(lt({ id: 'ok', nome: 'X', eps: 'x', vis: [] }), null, 'eps precisa ser lista');
  const t = lt(
    {
      id: 'ok-1',
      tipo: 'tv',
      nome: 'Série',
      eps: ['<b>', 5, 99999],
      vis: ['"x', 9, 3],
      nota: '9.87',
      nota_pessoal: '<i>',
      duracao: -4,
      tmdb: 'abc',
      capa: 'javascript:alert(1)',
      ano: 2020,
      hist: { '2026-11': 3, 'x"y': 9, '2026-13': 4 },
      proximo: { d: '2026-11-06', t: '2"', e: 3 },
    },
    42,
  );
  assert.deepEqual(t.eps, [1, 5, 999], 'texto vira 1, números ficam no teto');
  assert.deepEqual(t.vis, [0, 5, 3], 'vistos nunca passam do total');
  assert.equal(t.nota, 9.9);
  assert.equal(t.nota_pessoal, null);
  assert.equal(t.duracao, 0);
  assert.equal(t.tmdb, null);
  assert.equal(t.capa, null);
  assert.equal(t.ano, null, 'ano numérico não é texto: descartado como no servidor');
  assert.deepEqual(t.hist, { '2026-11': 3 });
  assert.deepEqual(t.proximo, { d: '2026-11-06', e: 3 });
  assert.equal(t.criado, 42, 'sem "criado" no arquivo usa o padrão');
  assert.deepEqual(lt({ id: 'f', tipo: 'movie', nome: 'Filme', eps: [7, 7], vis: [5] }).eps, [1], 'filme tem sempre 1');

  assert.equal(capaSegura('https://image.tmdb.org/t/p/w342/abc.jpg'), 'https://image.tmdb.org/t/p/w342/abc.jpg');
  assert.equal(capaSegura('https://image.tmdb.org/x"onerror="y'), null);
  assert.equal(capaSegura('https://evil.example/a.jpg'), null);
  assert.equal(capaSegura('https://abc.public.blob.vercel-storage.com/capas/u1/c-1.jpg') !== null, true);
  assert.equal(capaSegura('https://abc.public.blob.vercel-storage.com/outra/u1/c.jpg'), null);
  assert.equal(capaSegura('data:image/jpeg;base64,/9j/AAA=') !== null, true);
  assert.equal(capaSegura('data:image/svg+xml;base64,AAAA'), null);

  const top = lp({ id: 't1', nome: 'Top', itens: [{ t: 'A', sid: 'ok' }, { t: 'B', sid: '"><x>' }, { t: '' }, null, ...Array(20).fill({ t: 'Z' })] });
  assert.equal(top.itens.length, 8, 'corta em 10 e depois tira os vazios (igual ao servidor), então nunca passa de 10');
  assert.equal(top.itens[0].sid, 'ok');
  assert.equal(top.itens[1].sid, undefined);
  assert.equal(lp({ id: 'a b', itens: [] }), null);
  assert.equal(lp({ id: 'ok', itens: 'x' }), null);
});

/* ---------- radar de afinidade e retrato do espectador ---------- */
test('sementesRadar: nota 7+, concluído ou em andamento sem nota; melhor nota primeiro; idsRadar leva a nota', async () => {
  const { sementesRadar, idsRadar, frasePorque } = await R();
  const l = [
    serie({ id: '1', tmdb: 1, vis: [10, 8], nota_pessoal: 10, nome: 'Alfa' }),
    serie({ id: '2', tmdb: 2, vis: [10, 8] }), // concluída sem nota: vale
    serie({ id: '3', tmdb: 3, vis: [1, 0] }), // em andamento, sem nota: vale (você está assistindo)
    serie({ id: '4', tmdb: 4, vis: [10, 8], nota_pessoal: 4 }), // nota baixa: fora
    serie({ id: '5', vis: [10, 8], nota_pessoal: 9 }), // sem TMDb: fora
    serie({ id: '6', tmdb: 6, vis: [1, 0], nota_pessoal: 8 }), // começada mas com nota alta: vale
  ];
  const sem = sementesRadar(l, 'tv');
  assert.deepEqual(
    sem.map(s => s.id),
    ['1', '6', '3', '2'],
  );
  assert.deepEqual(idsRadar(sem), ['1:10', '6:8', '3', '2']);
  assert.equal(frasePorque({ tipo: 'dir', nome: 'Nolan' }, sem[0]), 'Como você concluiu Alfa e deu nota 10: mesma criação (Nolan).');
  assert.match(frasePorque({ tipo: 'rec' }, sem[1]), /^Como você viu Série e deu nota 8: /);
  assert.equal(frasePorque({ tipo: 'x' }, sem[0]), '');
});

test('perfilEspectador: mês ativo, jeito de avaliar, tempo e título campeão', async () => {
  const { perfilEspectador } = await R();
  const agora = Date.parse('2026-11-12T12:00:00');
  const l = [
    serie({ id: '1', eps: [4], vis: [4], duracao: 60, nota_pessoal: 10, nota: 8, hist: { '2026-10': 1, '2026-11': 3 } }),
    serie({ id: '2', eps: [4], vis: [4], duracao: 60, nota_pessoal: 9, nota: 8, nome: 'B', hist: { '2026-11': 4 } }),
    serie({ id: '3', eps: [4], vis: [2], duracao: 60, nota_pessoal: 8, nota: 7, hist: {} }),
  ];
  const p = perfilEspectador(l, agora);
  assert.equal(p.mesAtivo.rotulo, 'novembro de 2026');
  assert.equal(p.mesAtivo.valor, 7);
  assert.equal(p.mesAtivo.atual, true);
  assert.equal(p.jeito.perfil, 'generoso');
  assert.equal(p.jeito.dezes, 1);
  assert.equal(p.jeito.pctAltas, 100);
  assert.equal(p.jeito.dif, 1.3);
  assert.equal(p.tempo.minutos, 600);
  assert.ok(p.tempo.comparacoes.some(c => /voo/.test(c)));
  assert.equal(p.campeao.minutos, 240);
  const vazio = perfilEspectador([serie()], agora);
  assert.equal(vazio.mesAtivo, null);
  assert.equal(vazio.jeito, null);
  assert.equal(vazio.tempo, null);
  assert.equal(perfilEspectador([serie({ nota_pessoal: 3 }), serie({ nota_pessoal: 4 }), serie({ nota_pessoal: 5 })], agora).jeito.perfil, 'rigoroso');
});

test('backup: a nota de rodapé do top é limpa e limitada', async () => {
  const { limparTopBackup, OBS_MAX } = await R();
  const t = limparTopBackup({
    id: 't1',
    nome: 'T',
    itens: [
      { t: 'A', obs: '  Assisti em 2024  ' },
      { t: 'B', obs: 'x'.repeat(500) },
      { t: 'C', obs: 42 },
    ],
  });
  assert.equal(t.itens[0].obs, 'Assisti em 2024');
  assert.equal(t.itens[1].obs.length, OBS_MAX);
  assert.equal(t.itens[2].obs, undefined);
});

test('radar: o que você está assistindo agora sobe; frase e bônus de momento', async () => {
  const { sementesRadar, frasePorque, bonusMomento } = await R();
  const agora = Date.parse('2026-11-14T12:00:00');
  const dia = 864e5;
  const l = [
    serie({ id: 'a', tmdb: 1, vis: [10, 8], nota_pessoal: 8, visto_em: agora - 200 * dia }), // concluída há muito tempo
    serie({ id: 'b', tmdb: 2, vis: [2, 0], visto_em: agora - 2 * dia }), // em andamento, sem nota, vista esta semana
    serie({ id: 'c', tmdb: 3, vis: [2, 0], nota_pessoal: 3, visto_em: agora - dia }), // nota baixa: fora mesmo em andamento
  ];
  assert.deepEqual(
    sementesRadar(l, 'tv', 6, agora).map(s => s.id),
    ['b', 'a'],
  );
  assert.equal(bonusMomento(l[1], agora), 1.5);
  assert.equal(bonusMomento(l[0], agora), 0);
  assert.match(frasePorque({ tipo: 'vibe' }, l[1]), /^Como você está assistindo .+: mesma vibe, com temas parecidos\.$/);
});

test('ehBackupDoApp: reconhece o backup do próprio app (novo e antigo) e recusa o que não é', async () => {
  const { ehBackupDoApp } = await R();
  const t = { id: 'a', nome: 'X', eps: [1], vis: [0] };
  assert.equal(ehBackupDoApp({ app: 'somaisumep', versao: 4, series: [t], tops: [] }), true);
  assert.equal(ehBackupDoApp({ app: 'somaisumep', series: [] }), true); // backup do app, só sem títulos
  assert.equal(ehBackupDoApp({ series: [t] }), true); // versão antiga, sem o campo `app`
  assert.equal(ehBackupDoApp({ series: [{ nome: 'sem eps' }] }), false);
  assert.equal(ehBackupDoApp([t]), false); // lista solta (ex.: Trakt)
  assert.equal(ehBackupDoApp({ watched: [] }), false);
  assert.equal(ehBackupDoApp(null), false);
});

test('radar: títulos sem id do TMDb entram pelo nome ligado; precisaLigar e jaNaEstante', async () => {
  const { sementesRadar, precisaLigar, jaNaEstante } = await R();
  const l = [
    serie({ id: 'x', nome: 'Dark', tmdb: null, vis: [3, 0] }), // em andamento, sem id do TMDb
    serie({ id: 'y', nome: 'Lost', tmdb: null, vis: [0, 0] }), // nunca começou: não serve
    serie({ id: 'z', nome: 'Ruim', tmdb: null, vis: [3, 0], nota_pessoal: 3 }), // nota baixa: não serve
    serie({ id: 'w', nome: 'Ruptura', tmdb: 7, vis: [3, 0] }),
  ];
  assert.deepEqual(
    precisaLigar(l, 'tv').map(s => s.id),
    ['x'],
  );
  assert.deepEqual(precisaLigar(l, 'tv', { x: { t: 0 } }), []); // já procurado
  assert.deepEqual(
    sementesRadar(l, 'tv').map(s => s.id),
    ['w'],
  );
  const com = sementesRadar(l, 'tv', 6, Date.now(), { x: 1002 });
  assert.deepEqual(com.map(s => [s.id, s.tmdb]).sort(), [
    ['w', 7],
    ['x', 1002],
  ]);
  // Sugestão que você já tem sem id do TMDb não volta a aparecer; com ano diferente (outra obra) aparece.
  const est = [serie({ id: 'k', nome: 'Dark', ano: '2017', tmdb: null })];
  assert.equal(jaNaEstante(est, 'tv', { id: 1002, nome: 'Dark', ano: '2017' }), true);
  assert.equal(jaNaEstante(est, 'tv', { id: 9, nome: 'Dark', ano: '1999' }), false);
  assert.equal(jaNaEstante(est, 'movie', { id: 1002, nome: 'Dark', ano: '2017' }), false);
});
