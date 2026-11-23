// Identidade da marca: ícones, favicon, nome em três pesos e coerência de cores entre ícone, manifesto e interface.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ler = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const bin = f => fs.readFileSync(path.join(__dirname, '..', f));
const lum = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const tamanhoPng = f => {
  const b = bin(f);
  assert.equal(b.toString('latin1', 1, 4), 'PNG', f + ' é um PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test('ícones: ícone completo e favicon simplificado usam as cores da marca e têm nome acessível', () => {
  for (const f of ['public/icons/icon.svg', 'public/icons/favicon.svg']) {
    const s = ler(f);
    assert.match(s, /role="img" aria-label="SóMaisUmEp"/, f);
    for (const cor of ['#ff8460', '#e03d1f', '#fbf3e2', '#14161a']) assert.ok(s.includes(cor), `${f} usa ${cor}`);
    assert.ok(!s.includes('#d8381c'), `${f} não usa mais o vermelho antigo`);
  }
  assert.ok(!ler('public/icons/favicon.svg').includes('stroke-dasharray'), 'o favicon não leva a perfuração (ilegível em 16 px)');
});

test('ícones PNG: tamanhos certos, transparência só onde o sistema não arredonda sozinho', () => {
  assert.deepEqual(tamanhoPng('public/icons/icon-192.png'), [192, 192]);
  assert.deepEqual(tamanhoPng('public/icons/icon-512.png'), [512, 512]);
  assert.deepEqual(tamanhoPng('public/icons/icon-maskable-512.png'), [512, 512]);
  assert.deepEqual(tamanhoPng('public/icons/apple-touch-icon.png'), [180, 180]);
  const tipo = f => bin(f)[25]; // 2 = RGB, 6 = RGBA
  assert.equal(tipo('public/icons/apple-touch-icon.png'), 2, 'o iOS não aceita transparência no ícone');
  assert.equal(tipo('public/icons/icon-512.png'), 6, 'os cantos arredondados são transparentes');
});

test('favicon: página, página pública e service worker apontam para o favicon simplificado', () => {
  assert.match(ler('public/index.html'), /rel="icon" href="\/icons\/favicon\.svg"/);
  assert.match(ler('api/_pagina.js'), /rel="icon" href="\/icons\/favicon\.svg"/);
  assert.match(ler('public/sw.js'), /'\/icons\/favicon\.svg'/);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'public/icons/favicon.svg')));
});

test('nome da marca: três pesos (Só / MaisUm / Ep em coral) no cabeçalho, na entrada e na imagem de compartilhar', () => {
  assert.match(ler('public/index.html'), /<span>Só<b>MaisUm<\/b><em>Ep<\/em><\/span>/);
  assert.match(ler('public/index.html'), /aria-label="SóMaisUmEp, início"/, 'o nome acessível continua inteiro');
  assert.match(ler('public/js/views/conta.js'), /<p class="auth-nome">Só<b>MaisUm<\/b><em>Ep<\/em><\/p>/);
  assert.match(ler('public/js/compartilhar.js'), /\['Só', 500, COR\.tx\], \['MaisUm', 800, COR\.tx\], \['Ep', 800, COR\.acc\]/);
  const css = ler('public/style.css');
  assert.match(css, /\.marca em,\.auth-nome em\{font-style:normal;font-weight:800;color:var\(--acc\)\}/);
  assert.match(css, /inter-800\.woff/, 'o peso 800 do nome está hospedado');
});

test('nome da marca: o “Ep” em coral tem contraste de texto (≥ 4,5:1) sobre o cabeçalho e o cartão nos dois temas', () => {
  const css = ler('public/style.css');
  const bloco = re => css.match(re)[1];
  const claro = bloco(/:root\{([^}]*)\}/),
    escuro = bloco(/:root\[data-theme="dark"\]\{([^}]*)\}/);
  const tok = (b, n) => b.match(new RegExp(`--${n}:(#[0-9a-fA-F]{6})`))[1];
  for (const [nome, b] of [
    ['claro', claro],
    ['escuro', escuro],
  ])
    for (const fundo of ['rail', 'card']) assert.ok(contraste(tok(b, 'acc'), tok(b, fundo)) >= 4.5, `${nome}: --acc sobre --${fundo}`);
});

test('ícone: tinta sobre creme legível e o ícone combina com o manifesto e o tema escuro', () => {
  assert.ok(contraste('#14161a', '#fbf3e2') >= 12, 'o “+1” se lê com folga');
  const m = JSON.parse(ler('public/manifest.json'));
  const css = ler('public/style.css');
  const bgEscuro = css.match(/:root\[data-theme="dark"\]\{\s*--bg:(#[0-9a-f]{6})/i)[1];
  assert.equal(m.background_color, bgEscuro);
  assert.equal(m.theme_color, bgEscuro);
  assert.ok(
    m.icons.some(i => i.purpose === 'maskable'),
    'há ícone maskable',
  );
  assert.equal(ler('public/icons/icon.svg').match(/#14161a/g).length >= 1, true);
  assert.equal(css.match(/:root\[data-theme="dark"\]\{[^}]*--card:(#[0-9a-f]{6})/i)[1], '#14161a', 'a tinta do ícone é o mesmo tom do cartão escuro');
});

test('estado vazio da estante usa o ingresso da marca em traço fino', () => {
  assert.match(
    ler('public/js/views/estante.js'),
    /const VAZIO_ICO = raw\(\s*'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4/,
  );
});
