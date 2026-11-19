// Redesenho v5.6 (atualizado para o visual "Cinema escuro"): frase curta do "por quê", carrossel de "Continuar assistindo", progresso concluído, status em ícone e regras de layout.
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

test('Continuar assistindo: todos os cartões iguais (mesma capa 2:3, mesmo +1 redondo), com setas flutuantes e sem destaque gigante', async () => {
  const V = await import('../public/js/views.js');
  const { L } = await import('../public/js/loja.js');
  const agora = Date.now();
  L.series = [
    serie({ id: 'a', nome: 'A', visto_em: agora }),
    serie({ id: 'b', nome: 'B', visto_em: agora - 1e3 }),
    serie({ id: 'c', nome: 'C', visto_em: agora - 2e3 }),
  ];
  const h = String(V.htmlContinuar('tv'));
  assert.match(h, /<div class="carrossel fila-car">/);
  assert.match(h, /<div class="fila-trilho">/);
  assert.equal((h.match(/class="card cc"/g) || []).length, 3, 'três cartões, todos do mesmo tipo');
  assert.doesNotMatch(h, /cc-hero|cc-peq|mais-grande|Só mais um ep/, 'sem o card horizontal gigante nem o botão laranja de largura total');
  assert.equal((h.match(/class="mais"/g) || []).length, 3, 'um +1 redondo por cartão');
  assert.equal((h.match(/class="seta (esq|dir)"/g) || []).length, 2, 'setas nas duas pontas');
  assert.match(h, /<button class="capa"[^>]*>[\s\S]*?<span class="linha"[\s\S]*?<\/button>/, 'o fio de progresso fica dentro da capa, na base da imagem');
  assert.match(h, /T1 · E4/, 'o próximo episódio aparece embaixo do título');
  L.series = [serie({ id: 'a', nome: 'A', visto_em: agora })];
  assert.match(String(V.htmlContinuar('tv')), /class="fila-trilho so-um"/);
});

test('Próximos episódios: faixa com setas, cartão de superfície e data em coral suave (a de hoje em coral cheio)', async () => {
  const V = await import('../public/js/views.js');
  const { L } = await import('../public/js/loja.js');
  const iso = n => {
    const d = new Date(Date.now() + n * 864e5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  L.series = [serie({ id: 'p1', nome: 'Hoje', proximo: { d: iso(0), t: 2, e: 3 } }), serie({ id: 'p2', nome: 'Em breve', proximo: { d: iso(3), t: 1, e: 4 } })];
  const h = String(V.htmlProximos('tv'));
  assert.match(h, /<div class="carrossel prox-car">/);
  assert.match(h, /<ul class="prox-lista">/);
  assert.equal((h.match(/class="prox-i/g) || []).length, 2);
  assert.match(h, /class="prox-i hoje"/);
  assert.equal((h.match(/class="seta (esq|dir)"/g) || []).length, 2);
  assert.match(css, /\.prox-data\{[^}]*background:var\(--acc-suave\);color:var\(--acc\)/);
  assert.match(css, /\.prox-i\.hoje \.prox-data\{background:var\(--acc\)/);
  assert.match(css, /\.prox-b\{[^}]*border:1px solid var\(--line\)[^}]*background:var\(--card\)/);
  assert.doesNotMatch(css, /\.prox-b\{[^}]*2px solid/, 'sem bordas laranjas ou grossas por bloco');
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

test('layout: cabeçalho de vidro fixo com abas de texto, container centralizado, grade fluida, filtros de mesma altura e estatísticas em linha', () => {
  assert.match(css, /--topo:68px/);
  assert.match(css, /\.rail\{position:sticky;top:0;[^}]*backdrop-filter:blur\(12px\)/, 'cabeçalho fixo com vidro fosco');
  assert.match(css, /@media \(min-width:900px\)\{\s*body:not\(\.deslogado\) \.rail\{display:grid;grid-template-columns:1fr auto 1fr/);
  assert.match(css, /body:not\(\.deslogado\) \.menu\{position:static[^}]*background:none;border:0/, 'sem a caixa em volta do menu central');
  assert.match(css, /body:not\(\.deslogado\) \.menu \.ico\{display:none\}/, 'abas só com texto no computador');
  assert.match(css, /\.menu a\[aria-current=page\]::after\{[^}]*background:var\(--acc\)/, 'aba ativa com marca coral');
  assert.match(css, /\.menu\{position:fixed;left:12px;right:12px;bottom:calc\(12px/);
  assert.match(css, /--max:1280px;--gut:24px/);
  assert.match(css, /@media \(min-width:900px\)\{:root\{--gut:48px\}\}/);
  assert.match(css, /\.palco\{[^}]*max-width:var\(--max\);margin:0 auto;padding:0 var\(--gut\)/);
  assert.match(css, /@media \(min-width:640px\)\{\.grade\{grid-template-columns:repeat\(auto-fill,minmax\(180px,1fr\)\);gap:24px\}\}/);
  assert.match(css, /\.ferramentas:not\(\.centro\) \.barra-acoes\{position:sticky;top:calc\(var\(--topo\)/);
  assert.match(
    css,
    /\.ferramentas \.chip,\.ferramentas input\[type=search\],\.ferramentas select\{height:var\(--h-ctl\)/,
    'filtros, busca e ordenação com a mesma altura',
  );
  assert.match(css, /--h-ctl:40px/);
  assert.match(css, /\.chip\[aria-pressed=true\]\{background:var\(--tx\)[^}]*color:var\(--bg\)/, 'filtro ativo: fundo claro e texto escuro');
  assert.match(css, /\.stats:not\(\.numeros\) \.stat\+\.stat::before\{content:"•"/, 'estatísticas em linha, separadas por ponto médio');
  assert.doesNotMatch(css, /\.stat\{[^}]*border-radius:var\(--pilula\)/, 'sem pílulas com borda em volta dos números');
  assert.match(css, /\.w-card\{[^}]*background:var\(--card\);border:1px solid var\(--line\)/);
  assert.match(css, /\.w-tempo b\{[^}]*color:var\(--acc\)/, 'o número grande leva o coral no texto, não num bloco sólido');
  assert.match(css, /@media \(hover:none\)\{\.grade \.menos\{display:none\}\}/);
  assert.doesNotMatch(css, /--lateral/, 'a barra lateral não existe mais');
});

test('cartões: progresso de 3px na base da capa e +1 redondo de vidro que vira coral ao passar o mouse', () => {
  assert.match(css, /\.linha\{position:absolute;[^}]*bottom:0;height:3px/);
  assert.match(css, /\.mais\{[^}]*width:36px;height:36px;[^}]*border-radius:50%;[\s\S]*?backdrop-filter:blur\(8px\)/);
  assert.match(css, /\.mais:hover,\.mais:focus-visible\{background:var\(--acc\)/);
  assert.match(css, /\.carrossel\.m-dir>\.fila-trilho[^{]*\{[^}]*mask-image:linear-gradient\(to right/, 'véu de esmaecimento na borda direita');
  assert.match(css, /\.seta\{[^}]*opacity:0/);
  assert.match(css, /\.carrossel:hover>\.seta/, 'as setas aparecem ao passar o mouse');
  assert.match(css, /\.card\.cc\{flex:none;width:var\(--cw\)/, 'todos os itens da faixa têm a mesma largura');
});

test('paleta: fundo liso #0b0c0e, superfície #14161a, bordas de 8%, coral #ff7a59 só como acento; textos em branco gelo e cinza ardósia', () => {
  const claro = /:root\{[^}]*\}/.exec(css)[0],
    escuro = /:root\[data-theme="dark"\]\{[^}]*\}/.exec(css)[0];
  assert.match(escuro, /--bg:#0b0c0e/);
  assert.match(escuro, /--card:#14161a/);
  assert.match(escuro, /--tx:#f8fafc/);
  assert.match(escuro, /--mut:#94a3b8/);
  assert.match(escuro, /--acc:#ff7a59/);
  assert.match(escuro, /--acc-suave:rgba\(255,122,89,\.15\)/);
  assert.match(escuro, /--line:rgba\(255,255,255,\.08\)/);
  assert.match(escuro, /--vidro:rgba\(20,22,26,\.7\)/);
  assert.match(escuro, /--ok:#3ddc97/);
  assert.match(claro, /--bg:#f6f7f9/);
  assert.match(claro, /--acc:#c2410c/);
  assert.match(css, /\.sel\.dir\{[^}]*color:#ffd37a/);
  assert.doesNotMatch(css, /radial-gradient\(var\(--line\)/, 'sem a textura de pontos no fundo');
  assert.doesNotMatch(css, /body\{[^}]*background-image/, 'fundo liso');
  assert.doesNotMatch(css, /#9566fa|#6d3fe0|#121214|#f5f5f7|#13100c|#f2ecdf/, 'nada das paletas antigas');
  for (const f of ['public/index.html', 'public/manifest.json', 'api/_pagina.js']) assert.match(ler(f), /#0b0c0e/, f);
  assert.match(ler('public/js/telas/tema.js'), /#0b0c0e' : '#f6f7f9'/);
});

test('identidade: tudo em Inter (títulos 600/700), sem sombras duras nem bordas grossas, e a imagem de compartilhar usa a mesma paleta do app', () => {
  assert.doesNotMatch(css, /--serifa|Iowan|Palatino|Georgia/, 'sem serifa');
  assert.match(css, /h1,h2,h3\{color:var\(--tx\);font-weight:600/);
  assert.match(css, /h1\{[^}]*font-weight:700/);
  assert.doesNotMatch(css, /\b[234]px solid var\(--tx\)/, 'sem bordas grossas de tinta');
  assert.doesNotMatch(css, /box-shadow:[^;}]*\b\d+px \d+px 0 /, 'sem sombras duras deslocadas');
  assert.doesNotMatch(css, /\b[2-9]px dashed/, 'sem divisórias tracejadas grossas (só o estado vazio leva 1px tracejado)');
  const img = ler('public/js/compartilhar.js');
  assert.match(img, /fundo: '#0b0c0e'/);
  assert.match(img, /acc: '#ff7a59'/);
  assert.doesNotMatch(img, /#6ea8fe|#0c0e13|#f2ecdf|#c7321a|SERIFA/, 'sem as cores nem a serifa antigas na imagem');
});

test('gesto de deslizar: só toque, só na grade, e usa os botões de sempre (+1 e abrir)', () => {
  const j = ler('public/js/telas/estante.js');
  assert.match(j, /e\.pointerType === 'touch'/);
  assert.match(j, /closest\('\.grade \.poster'\)/);
  assert.match(j, /querySelector\('\.mais'\)\?\.click\(\)/);
  assert.match(j, /querySelector\('\[data-act="abrir"\]'\)\?\.click\(\)/);
  assert.match(css, /\.grade \.poster\{touch-action:pan-y\}/);
});
