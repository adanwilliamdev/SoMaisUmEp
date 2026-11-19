// Redesenho v5.6: frase curta do "por quê", carrossel de "Continuar assistindo", progresso concluído, status em ícone e regras de layout.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ler = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const css = ler('public/style.css');
const serie = (o = {}) => ({ id: 's1', tipo: 'tv', nome: 'Série', eps: [10, 8], vis: [3, 0], criado: 1, hist: {}, ...o });

test('fraseCurtaPorque: uma frase curta por tipo de motivo, sem inventar quando falta dado', async () => {
  const { fraseCurtaPorque } = await import('../public/js/regras.js');
  const tv = serie({ nome: 'Succession' }),
    filme = serie({ tipo: 'movie', nome: 'Duna', eps: [1], vis: [1] });
  assert.equal(fraseCurtaPorque({ tipo: 'genero', nome: 'Drama' }, tv), 'Baseado no seu gosto por Drama');
  assert.equal(fraseCurtaPorque({ tipo: 'dir', nome: 'Nolan' }, filme), 'Direção de Nolan');
  assert.equal(fraseCurtaPorque({ tipo: 'dir', nome: 'Armstrong' }, tv), 'Criação de Armstrong');
  assert.equal(fraseCurtaPorque({ tipo: 'ator', nome: 'Jean Smart' }, tv), 'Com Jean Smart');
  assert.equal(fraseCurtaPorque({ tipo: 'vibe' }, tv), 'Mesma vibe de Succession');
  assert.equal(fraseCurtaPorque({ tipo: 'rec' }, tv), 'Para quem curtiu Succession');
  assert.equal(fraseCurtaPorque({ tipo: 'rec' }, null), '');
  assert.equal(fraseCurtaPorque({ tipo: 'x' }, tv), '');
  assert.equal(fraseCurtaPorque(null, tv), '');
  assert.ok(fraseCurtaPorque({ tipo: 'genero', nome: 'Drama' }, tv).length < 60);
});

test('Descobrir: o motivo vira uma frase curta com botão "por que estou vendo isso?" e o texto completo no balão', async () => {
  const { htmlDescobrir } = await import('../public/js/views/descobrir.js');
  const { L } = await import('../public/js/loja.js');
  L.series = [];
  const sementes = [serie({ tmdb: 11, nome: 'Succession', vis: [10, 8], nota_pessoal: 9 })];
  const radar = {
    dna: { generos: [{ nome: 'Drama', n: 2 }] },
    resultados: [{ id: 5, nome: 'Industry', ano: 2020, nota: 8, poster: null, onde: [], porque: [{ tipo: 'genero', seed: 11, nome: 'Drama' }] }],
  };
  const h = String(htmlDescobrir('tv', { radar, sementes }));
  assert.match(h, /class="porque-btn" data-act="porque" aria-expanded="false" aria-controls="p-5"/);
  assert.match(h, /<span>Baseado no seu gosto por Drama<\/span>/);
  assert.match(h, /role="tooltip"[^>]*><strong>Por que estou vendo isso\?<\/strong><p>Como você concluiu Succession e deu nota 9: mesmo clima: Drama\.<\/p>/);
  assert.doesNotMatch(h, /<p class="porque">/, 'o parágrafo longo não fica mais solto sob o título');
  assert.match(h, /<details class="dna-base"><summary>Baseado em 1 título que você curtiu<\/summary>/);
});

test('Continuar assistindo: carrossel com o destaque primeiro e capas menores depois; sozinho, só o destaque', async () => {
  const V = await import('../public/js/views.js');
  const { L } = await import('../public/js/loja.js');
  const agora = Date.now();
  L.series = [
    serie({ id: 'a', nome: 'A', visto_em: agora }),
    serie({ id: 'b', nome: 'B', visto_em: agora - 1e3 }),
    serie({ id: 'c', nome: 'C', visto_em: agora - 2e3 }),
  ];
  const h = String(V.htmlContinuar('tv'));
  assert.match(h, /<div class="fila-trilho">/);
  assert.equal((h.match(/cc-hero/g) || []).length > 0, true);
  assert.equal((h.match(/class="card cc cc-peq"/g) || []).length, 2);
  assert.ok(h.indexOf('cc-hero') < h.indexOf('cc-peq'), 'o destaque vem antes');
  assert.doesNotMatch(h, /fila-grade|fila-resto/);
  L.series = [serie({ id: 'a', nome: 'A', visto_em: agora })];
  assert.match(String(V.htmlContinuar('tv')), /class="fila-trilho so-um"/);
});

test('progresso concluído fica verde (classe fim) e o em andamento não', async () => {
  const V = await import('../public/js/views.js');
  const andamento = String(V.cardHtml(serie({ vis: [3, 0] }), 0));
  const completo = String(V.cardHtml(serie({ vis: [10, 8] }), 0));
  assert.match(andamento, /<i class="" data-w="\d+">/);
  assert.match(completo, /<i class="fim" data-w="100">/);
  assert.match(css, /\.linha i\.fim,\.barra i\.fim\{background:var\(--ok\)\}/);
});

test('status vira ícone: o estado vai em data-estado e o texto continua no tooltip', async () => {
  const { status } = await import('../public/js/util.js');
  const el = { textContent: '', dataset: {} };
  globalThis.document = { querySelector: sel => (sel === '#status' ? el : null), querySelectorAll: () => [] };
  status('Salvo ✓');
  assert.deepEqual([el.dataset.estado, el.title], ['ok', 'Salvo ✓']);
  status('Salvando…');
  assert.equal(el.dataset.estado, 'ocupado');
  status('Sem conexão');
  assert.equal(el.dataset.estado, 'off');
  status('Erro ao salvar: x', true);
  assert.equal(el.dataset.estado, 'erro');
  assert.match(css, /\.status\{[^}]*font-size:0/);
  globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
});

test('layout: barra lateral no computador, abas embaixo no celular, filtros colados e blocos translúcidos nas estatísticas', () => {
  assert.match(css, /--lateral:236px/);
  assert.match(css, /@media \(min-width:900px\)\{\s*body:not\(\.deslogado\) \.casa\{flex-direction:row/);
  assert.match(css, /body:not\(\.deslogado\) \.menu\{[^}]*flex-direction:column/);
  assert.match(css, /\.menu\{position:fixed;left:0;right:0;bottom:0/);
  assert.match(css, /\.ferramentas:not\(\.centro\) \.barra-acoes\{position:sticky;top:calc\(var\(--topo\)/);
  assert.match(css, /--bloco:rgba\(255,255,255,\.03\);--bloco-b:rgba\(255,255,255,\.1\)/);
  assert.match(css, /\.w-card\{[^}]*background:var\(--bloco\);border:1px solid var\(--bloco-b\)/);
  assert.match(css, /@media \(hover:none\)\{\.grade \.menos\{display:none\}\}/);
});

test('paleta: fundo #121214, destaque violeta, verde menta no concluído e ouro nas notas altas', () => {
  assert.match(css, /--bg:#121214/);
  assert.match(css, /--acc:#9566fa/);
  assert.match(css, /--ok:#10b981/);
  assert.match(css, /--mut:#9ca3af/);
  assert.match(css, /\.sel\.dir\{[^}]*color:#f5b544/);
  for (const f of ['public/index.html', 'public/manifest.json']) assert.match(ler(f), /#121214/, f);
});

test('gesto de deslizar: só toque, só na grade, e usa os botões de sempre (+1 e abrir)', () => {
  const j = ler('public/js/telas/estante.js');
  assert.match(j, /e\.pointerType === 'touch'/);
  assert.match(j, /closest\('\.grade \.poster'\)/);
  assert.match(j, /querySelector\('\.mais'\)\?\.click\(\)/);
  assert.match(j, /querySelector\('\[data-act="abrir"\]'\)\?\.click\(\)/);
  assert.match(css, /\.grade \.poster\{touch-action:pan-y\}/);
});
