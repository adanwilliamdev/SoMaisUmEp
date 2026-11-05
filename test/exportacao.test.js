// Exportação em formatos padrão (v5.2): planilha CSV e importação do Letterboxd.
const test = require('node:test');
const assert = require('node:assert/strict');

const serie = (o = {}) => ({
  id: 's',
  tipo: 'tv',
  nome: 'Série',
  ano: '2020',
  tmdb: 11,
  eps: [10, 8],
  vis: [10, 3],
  criado: Date.UTC(2026, 0, 5, 15),
  hist: {},
  ...o,
});
const filme = (o = {}) => ({
  id: 'f',
  tipo: 'movie',
  nome: 'Filme',
  ano: '2019-05-01',
  tmdb: 22,
  eps: [1],
  vis: [1],
  criado: Date.UTC(2026, 0, 5, 15),
  hist: {},
  ...o,
});

test('celula: aspas, vírgulas, quebras de linha e proteção contra fórmula de planilha', async () => {
  const { celula } = await import('../public/js/exportacao.js');
  assert.equal(celula('simples'), 'simples');
  assert.equal(celula('a,b'), '"a,b"');
  assert.equal(celula('diz "oi"'), '"diz ""oi"""');
  assert.equal(celula('l1\nl2'), '"l1\nl2"');
  assert.equal(celula(null), '');
  assert.equal(celula(7.5), '7.5');
  for (const f of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SOMA(A1)', '\tx', '\rx'])
    assert.ok(celula(f).replace(/^"/, '').startsWith("'"), 'neutraliza ' + JSON.stringify(f));
  assert.equal(celula('-3'), '-3', 'número negativo legítimo fica como está');
  assert.equal(celula('=1', { planilha: false }), '=1', 'sem proteção quando o destino não é planilha');
});

test('planilha: cabeçalho fixo, uma linha por título, BOM e CRLF; o próprio importador de CSV do app lê de volta', async () => {
  const { planilha, COLUNAS_PLANILHA } = await import('../public/js/exportacao.js');
  const { csv } = await import('../public/js/importacao.js');
  const s = serie({ nome: 'Dark, "Fase 2"', nota: 8.4, nota_pessoal: 9, resenha: 'Linha 1\nLinha 2', proximo: { d: '2026-12-01', t: 3, e: 1 } });
  const f = filme({ nome: '=CMD()', visto_em: Date.UTC(2026, 1, 10, 15), vis: [1] });
  const texto = planilha([s, f]);
  assert.ok(texto.startsWith('\uFEFF'), 'BOM para o Excel acertar os acentos');
  assert.ok(texto.endsWith('\r\n'));
  const linhas = csv(texto); // o importador devolve um objeto por linha, com o cabeçalho como chave
  assert.equal(linhas.length, 2);
  const c = linhas[0];
  assert.deepEqual(Object.keys(c), COLUNAS_PLANILHA);
  assert.equal(c.tipo, 'serie');
  assert.equal(c.titulo, 'Dark, "Fase 2"');
  assert.equal(c.temporadas, '2');
  assert.equal(c.episodios_total, '18');
  assert.equal(c.episodios_vistos, '13');
  assert.equal(c.eps_por_temporada, '10;8');
  assert.equal(c.vistos_por_temporada, '10;3');
  assert.equal(c.estado, 'assistindo');
  assert.equal(c.minha_nota, '9');
  assert.equal(c.proximo_lancamento, '2026-12-01');
  assert.equal(c.resenha, 'Linha 1\nLinha 2');
  const g = linhas[1];
  assert.equal(g.tipo, 'filme');
  assert.equal(g.titulo, "'=CMD()", 'título não vira fórmula na planilha');
  assert.equal(g.estado, 'concluido');
  assert.equal(g.assistido_em, '2026-02-10');
  assert.equal(g.temporadas, '');
});

test('estrelas: nota 0-10 vira 0,5-5 em meia estrela; sem nota fica vazio', async () => {
  const { estrelas } = await import('../public/js/exportacao.js');
  assert.deepEqual([10, 9, 7, 5, 1, 0.5].map(estrelas), ['5', '4.5', '3.5', '2.5', '0.5', '0.5']);
  for (const v of [0, null, undefined, '', 'x']) assert.equal(estrelas(v), '');
  assert.equal(estrelas(11), '5');
});

test('letterboxd: só filmes assistidos, colunas oficiais, data AAAA-MM-DD, resenha em HTML escapado, sem BOM nem apóstrofo', async () => {
  const { letterboxd, COLUNAS_LETTERBOXD, resenhaHtml } = await import('../public/js/exportacao.js');
  assert.deepEqual(COLUNAS_LETTERBOXD, ['tmdbID', 'Title', 'Year', 'WatchedDate', 'Rating', 'Review']);
  const series = [
    serie(), // série: fora
    filme({ id: 'a', nome: 'Visto, com nota', nota_pessoal: 9, visto_em: Date.UTC(2026, 1, 10, 15), resenha: 'Bom & "ótimo" <3\nSegunda linha' }),
    filme({ id: 'b', nome: '-Sem data', tmdb: null, ano: '', vis: [1] }),
    filme({ id: 'c', nome: 'Na fila', vis: [0] }), // não assistido: fora
  ];
  const t = letterboxd(series);
  assert.ok(!t.startsWith('\uFEFF'));
  const linhas = t.trim().split('\r\n');
  assert.equal(linhas[0], 'tmdbID,Title,Year,WatchedDate,Rating,Review');
  assert.equal(linhas.length, 3);
  assert.equal(linhas[1], '22,"Visto, com nota",2019,2026-02-10,4.5,"Bom &amp; ""ótimo"" &lt;3<br>Segunda linha"');
  assert.equal(linhas[2], ',-Sem data,,,,', 'título começando com "-" não recebe apóstrofo neste arquivo');
  assert.equal(resenhaHtml('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');
});

test('backup: o diálogo oferece os dois botões de exportação e o campo de arquivo continua focável pelo teclado', () => {
  const fs = require('fs');
  const b = fs.readFileSync(require('path').join(__dirname, '..', 'public/js/telas/backup.js'), 'utf8');
  assert.match(b, /data-act="exportar-csv"/);
  assert.match(b, /data-act="exportar-letterboxd"/);
  assert.doesNotMatch(b, /type="file"[^>]*\bhidden\b/);
});
