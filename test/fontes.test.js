// A fonte é hospedada aqui: nada de Google Fonts (privacidade, CSP mais curta e funciona offline).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const csp = () => {
  const cab = JSON.parse(ler('vercel.json')).headers.flatMap(h => h.headers);
  return cab.find(h => h.key === 'Content-Security-Policy').value;
};
const diretiva = (nome, politica) => (politica.split(';').map(d => d.trim()).find(d => d.startsWith(nome + ' ')) || '').split(/\s+/).slice(1);

test('fontes: todo @font-face do CSS aponta para um arquivo que existe em public/fonts', () => {
  const css = ler('public/style.css');
  const arquivos = [...css.matchAll(/url\((\/fonts\/[^)]+)\)/g)].map(m => m[1]);
  assert.ok(arquivos.length >= 5, 'pesos 400, 500, 600, 700 e 800');
  for (const a of arquivos) assert.ok(fs.existsSync(path.join(RAIZ, 'public', a)), a + ' não existe');
  assert.ok(fs.existsSync(path.join(RAIZ, 'public/fonts/LICENSE.txt')), 'a licença da fonte acompanha os arquivos');
});

test('fontes: nenhuma página nem o service worker pedem fonte ou CSS a terceiros', () => {
  for (const f of ['public/index.html', 'api/_pagina.js', 'public/sw.js', 'public/style.css']) {
    assert.doesNotMatch(ler(f), /fonts\.(googleapis|gstatic)\.com/, f);
  }
  assert.doesNotMatch(ler('public/index.html'), /<link[^>]+rel="stylesheet"[^>]+href="https?:/);
});

test('CSP: estilos e fontes só do próprio site; sem unsafe-inline/unsafe-eval em lugar nenhum', () => {
  const p = csp();
  assert.deepEqual(diretiva('style-src', p), ["'self'"]);
  assert.deepEqual(diretiva('font-src', p), ["'self'"]);
  assert.deepEqual(diretiva('script-src', p), ["'self'"]);
  assert.deepEqual(diretiva('connect-src', p).filter(h => /google|gstatic/.test(h)), []);
  assert.doesNotMatch(p, /unsafe-(inline|eval)/);
});

test('vercel.json: fontes têm cache longo (como os ícones)', () => {
  const regra = JSON.parse(ler('vercel.json')).headers.find(h => h.source === '/fonts/(.*)');
  assert.ok(regra, 'regra de cache para /fonts');
  assert.match(regra.headers.find(h => h.key === 'Cache-Control').value, /max-age=\d{7,}/);
});
