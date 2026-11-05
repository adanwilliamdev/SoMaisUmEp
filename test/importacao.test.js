const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');

const I = () => import('../public/js/importacao.js');

test('csv: aspas, vírgulas, quebras de linha em campos e BOM', async () => {
  const { csv } = await I();
  const r = csv('\uFEFFName,Year,Review\r\n"Amélie, a Fabulous",2001,"Linha 1\nLinha ""2"""\r\nParasita,2019,\r\n');
  assert.equal(r.length, 2);
  assert.equal(r[0].Name, 'Amélie, a Fabulous');
  assert.equal(r[0].Review, 'Linha 1\nLinha "2"');
  assert.equal(r[1].Year, '2019');
  assert.deepEqual(csv(''), []);
});

test('Letterboxd: watched, ratings (estrelas x2), watchlist e junção por título', async () => {
  const { lerArquivo, consolidar } = await I();
  const w = lerArquivo('watched.csv', 'Date,Name,Year,Letterboxd URI\n2024-05-01,Parasita,2019,https://boxd.it/1\n2024-05-02,Amélie,2001,https://boxd.it/2\n');
  const r = lerArquivo('letterboxd-ana/ratings.csv', 'Date,Name,Year,Letterboxd URI,Rating\n2024-05-01,Parasita,2019,https://boxd.it/1,4.5\n');
  const q = lerArquivo('watchlist.csv', 'Date,Name,Year,Letterboxd URI\n2024-06-01,Oldboy,2003,https://boxd.it/3\n');
  assert.equal(w.fonte, 'Letterboxd');
  const todos = consolidar([...w.entradas, ...r.entradas, ...q.entradas]);
  assert.equal(todos.length, 3);
  const p = todos.find(x => x.nome === 'Parasita');
  assert.equal(p.nota, 9);
  assert.equal(p.assistido, true);
  assert.equal(todos.find(x => x.nome === 'Oldboy').assistido, false);
  // data sem hora vale o dia local (não cai no mês anterior por causa do UTC)
  assert.equal(new Date(p.data).getMonth(), 4);
  assert.equal(new Date(p.data).getDate(), 1);
});

test('Letterboxd: ignora pastas deleted/lists/likes e arquivos desconhecidos', async () => {
  const { lerArquivo } = await I();
  const cab = 'Date,Name,Year,Letterboxd URI\n2024-05-01,X,2000,u\n';
  assert.equal(lerArquivo('deleted/watched.csv', cab), null);
  assert.equal(lerArquivo('lists/minha.csv', cab), null);
  assert.equal(lerArquivo('comments.csv', cab), null);
  assert.equal(lerArquivo('foto.png', 'x'), null);
});

test('IMDb: avaliações (filme assistido, série só com nota) e watchlist; episódios são ignorados', async () => {
  const { lerArquivo } = await I();
  const cab = 'Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year\n';
  const a = lerArquivo(
    'ratings.csv',
    cab +
      'tt0110912,9,2023-02-10,Pulp Fiction,Pulp Fiction,u,movie,8.9,154,1994\n' +
      'tt0903747,10,2023-03-01,Breaking Bad,Breaking Bad,u,tvSeries,9.5,49,2008\n' +
      'tt2301451,8,2023-03-02,Ozymandias,Ozymandias,u,tvEpisode,10,48,2013\n',
  );
  assert.equal(a.fonte, 'IMDb');
  assert.equal(a.entradas.length, 2);
  assert.equal(a.ignorados, 1);
  const [f, s] = a.entradas;
  assert.deepEqual([f.tipo, f.assistido, f.nota, f.imdb, f.ano], ['movie', true, 9, 'tt0110912', '1994']);
  assert.deepEqual([s.tipo, s.assistido, s.nota, s.soAvaliou], ['tv', false, 10, true]);
  const l = lerArquivo(
    'WATCHLIST.csv',
    'Position,Const,Created,Modified,Description,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year\n1,tt0816692,2024-01-01,2024-01-01,,Interstellar,u,Movie,8.7,169,2014\n',
  );
  assert.equal(l.entradas[0].assistido, false);
  assert.equal(l.entradas[0].nota, null);
});

test('Trakt: assistidos (filmes e séries com episódios), avaliações e watchlist', async () => {
  const { lerArquivo, consolidar } = await I();
  const filmes = lerArquivo(
    'watched-movies.json',
    JSON.stringify([
      { plays: 1, last_watched_at: '2024-03-10T20:00:00.000Z', movie: { title: 'Rain Man', year: 1988, ids: { tmdb: 380, imdb: 'tt0095953' } } },
    ]),
  );
  const series = lerArquivo(
    'watched-shows.json',
    JSON.stringify([
      {
        plays: 5,
        last_watched_at: '2024-04-02T00:00:00.000Z',
        show: { title: 'Dark', year: 2017, ids: { tmdb: 70523 } },
        seasons: [
          {
            number: 1,
            episodes: [
              { number: 1, last_watched_at: '2024-04-01T00:00:00.000Z' },
              { number: 2, last_watched_at: '2024-04-02T00:00:00.000Z' },
            ],
          },
          { number: 0, episodes: [{ number: 1 }] },
        ],
      },
    ]),
  );
  const notas = lerArquivo(
    'ratings.json',
    JSON.stringify([{ rated_at: '2024-04-03T00:00:00.000Z', rating: 10, type: 'show', show: { title: 'Dark', year: 2017, ids: { tmdb: 70523 } } }]),
  );
  const lista = lerArquivo(
    'watchlist.json',
    JSON.stringify([{ listed_at: '2024-01-01T00:00:00.000Z', type: 'movie', movie: { title: 'Heat', year: 1995, ids: { tmdb: 949 } } }]),
  );
  const hist = lerArquivo(
    'history.json',
    JSON.stringify({
      history: [
        {
          id: 1,
          watched_at: '2024-04-05T00:00:00.000Z',
          action: 'watch',
          type: 'episode',
          episode: { season: 1, number: 3 },
          show: { title: 'Dark', year: 2017, ids: { tmdb: 70523 } },
        },
      ],
      likes: [{ type: 'list' }],
    }),
  );
  assert.equal(filmes.fonte, 'Trakt');
  const todos = consolidar([...filmes.entradas, ...series.entradas, ...notas.entradas, ...lista.entradas, ...hist.entradas]);
  assert.equal(todos.length, 3);
  const dark = todos.find(x => x.nome === 'Dark');
  assert.equal(dark.nota, 10);
  assert.equal(dark.episodios.length, 4); // T1E1, T1E2, T0E1 (especial) e T1E3 do histórico
  assert.equal(todos.find(x => x.nome === 'Heat').assistido, false);
  assert.equal(lerArquivo('x.json', '{ quebrado'), null);
  assert.equal(lerArquivo('x.json', '[]'), null);
});

test('Trakt: coleção não conta como assistido', async () => {
  const { lerArquivo } = await I();
  assert.equal(lerArquivo('collection.json', JSON.stringify([{ collected_at: '2024-01-01T00:00:00.000Z', movie: { title: 'X', year: 2000, ids: {} } }])), null);
});

test('montarTitulo: filme assistido com data entra no histórico do mês', async () => {
  const { montarTitulo } = await I();
  const data = new Date(2024, 4, 1, 12).getTime();
  const t = montarTitulo(
    { tipo: 'movie', nome: 'Parasita', ano: '2019', assistido: true, nota: 9, data },
    { tmdb: 496243, nome: 'Parasita', ano: '2019', poster: 'https://image.tmdb.org/t/p/w342/a.jpg', duracao: 132, proximo: null },
    { id: 'x1', criado: 10 },
  );
  assert.deepEqual([t.tipo, t.eps, t.vis, t.nota_pessoal, t.visto_em, t.tmdb], ['movie', [1], [1], 9, data, 496243]);
  assert.deepEqual(t.hist, { '2024-05': 1 });
  const fila = montarTitulo({ tipo: 'movie', nome: 'Heat', assistido: false }, { tmdb: 949, nome: 'Heat' }, { id: 'x2' });
  assert.deepEqual([fila.vis, fila.visto_em, fila.hist], [[0], null, {}]);
});

test('montarTitulo: série usa o maior episódio por temporada, mapeia pelo número da temporada e ignora especiais', async () => {
  const { montarTitulo } = await I();
  const d = (m, dia) => new Date(2024, m, dia, 12).getTime();
  const e = {
    tipo: 'tv',
    nome: 'Dark',
    assistido: true,
    nota: 10,
    data: d(3, 5),
    episodios: [
      { t: 1, e: 1, data: d(3, 1) },
      { t: 1, e: 3, data: d(3, 5) },
      { t: 3, e: 2, data: d(4, 2) },
      { t: 0, e: 1 },
      { t: 2, e: 99 },
    ],
  };
  // O TMDb pulou a temporada 2: eps vem como T1 e T3
  const t = montarTitulo(e, { tmdb: 70523, nome: 'Dark', eps: [10, 8], nums: [1, 3] }, { id: 's1' });
  assert.deepEqual(t.eps, [10, 8]);
  assert.deepEqual(t.vis, [3, 2]);
  assert.deepEqual(t.hist, { '2024-04': 2, '2024-05': 1 });
  assert.equal(t.visto_em, d(4, 2));
  const sem = montarTitulo({ tipo: 'tv', nome: 'Z', assistido: false, episodios: [], nota: 8 }, { tmdb: 1, nome: 'Z', eps: [5] }, { id: 's2' });
  assert.deepEqual([sem.vis, sem.nota_pessoal, sem.visto_em], [[0], 8, null]);
});

test('resumo da importação', async () => {
  const { resumoImportacao } = await I();
  const r = resumoImportacao([
    { tipo: 'movie', assistido: true },
    { tipo: 'movie', assistido: false },
    { tipo: 'tv', episodios: [1, 2, 3] },
    { tipo: 'tv', episodios: [] },
  ]);
  assert.deepEqual(r, { filmesVistos: 1, filmesFila: 1, series: 2, episodios: 3, seriesSemProgresso: 1 });
});

/* ---------- ZIP ---------- */
// Monta um ZIP mínimo na hora (um arquivo guardado e um com deflate) para testar o leitor.
function criarZip(arquivos) {
  const partes = [],
    central = [];
  let pos = 0;
  for (const [nome, texto, metodo] of arquivos) {
    const bruto = Buffer.from(texto),
      dados = metodo === 8 ? zlib.deflateRawSync(bruto) : bruto,
      n = Buffer.from(nome);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(metodo, 8);
    lh.writeUInt32LE(dados.length, 18);
    lh.writeUInt32LE(bruto.length, 22);
    lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(metodo, 10);
    ch.writeUInt32LE(dados.length, 20);
    ch.writeUInt32LE(bruto.length, 24);
    ch.writeUInt16LE(n.length, 28);
    ch.writeUInt32LE(pos, 42);
    partes.push(lh, n, dados);
    central.push(ch, n);
    pos += 30 + n.length + dados.length;
  }
  const cd = Buffer.concat(central),
    fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(cd.length, 12);
  fim.writeUInt32LE(pos, 16);
  const b = Buffer.concat([...partes, cd, fim]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

test('lerZip: lê arquivos guardados e deflate, e respeita o filtro', async () => {
  const { lerZip, lerArquivo } = await I();
  const csvW = 'Date,Name,Year,Letterboxd URI\n2024-05-01,Amélie,2001,u\n';
  const zip = criarZip([
    ['watched.csv', csvW, 8],
    ['ratings.csv', 'Date,Name,Year,Letterboxd URI,Rating\n2024-05-01,Amélie,2001,u,5\n', 0],
    ['profile.csv', 'x', 8],
    ['lists/', '', 0],
  ]);
  const todos = await lerZip(zip, n => /\.csv$/.test(n));
  assert.deepEqual(
    todos.map(x => x.nome),
    ['watched.csv', 'ratings.csv', 'profile.csv'],
  );
  assert.equal(todos[0].texto, csvW); // acentos preservados (UTF-8)
  assert.equal(lerArquivo(todos[1].nome, todos[1].texto).entradas[0].nota, 10);
  assert.deepEqual(
    (await lerZip(zip, n => n === 'ratings.csv')).map(x => x.nome),
    ['ratings.csv'],
  );
  await assert.rejects(() => lerZip(new Uint8Array(40).buffer), /ZIP inválido/);
});

test('limitarImportacao: até o limite não mexe; acima, descarta o que já está na estante e põe assistidos na frente', async () => {
  const { limitarImportacao, MAX_IMPORTACAO } = await import('../public/js/importacao.js');
  assert.equal(MAX_IMPORTACAO, 3000);
  const e = Array.from({ length: 5 }, (_, i) => ({ nome: 'T' + i, assistido: i % 2 === 1 }));
  assert.deepEqual(
    limitarImportacao(e, () => false, 5),
    { entradas: e, cortadas: 0 },
  );
  const r = limitarImportacao(e, x => x.nome === 'T1', 3);
  assert.deepEqual(
    r.entradas.map(x => x.nome),
    ['T3', 'T0', 'T2'],
    'sem T1 (já tem); assistido T3 primeiro; resto na ordem original',
  );
  assert.equal(r.cortadas, 1, 'sobrou T4 para a segunda rodada');
  assert.equal(limitarImportacao(e, x => x.nome !== 'T4', 3).cortadas, 0, 'se o que já existe sai do cálculo e cabe, nada é cortado');
});
