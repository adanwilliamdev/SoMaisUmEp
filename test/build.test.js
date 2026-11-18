// Build (scripts/build.js): a versão do service worker vem do commit e todos os módulos entram no cache offline.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { construir, versao, modulos } = require('../scripts/build');

const PUBLIC = path.join(__dirname, '..', 'public');
const pasta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'build-'));

test('versao: usa o começo do commit e só caracteres seguros para nome de cache', () => {
  assert.equal(versao('0123456789abcdef0123'), 'somaisumep-0123456789');
  assert.equal(versao('ab c/../d!'), 'somaisumep-abcd');
  assert.match(versao(undefined, 12345), /^somaisumep-local[0-9a-z]+$/);
  assert.notEqual(versao('aaaaaaaaaa'), versao('bbbbbbbbbb'));
});

test('build: carimba o sw.js com o commit e lista todos os módulos de /js', () => {
  const destino = path.join(pasta(), 'dist');
  const r = construir({ origem: PUBLIC, destino, sha: 'deadbeefcafe1234' });
  const sw = fs.readFileSync(path.join(destino, 'sw.js'), 'utf8');
  assert.match(sw, /const VERSAO = 'somaisumep-deadbeefca';/);
  const lista = JSON.parse(/const MODULOS = (\[.*?\]);/s.exec(sw)[1]);
  assert.deepEqual(lista, r.modulos);
  const emDisco = [];
  const andar = d =>
    fs
      .readdirSync(d, { withFileTypes: true })
      .forEach(e =>
        e.isDirectory()
          ? andar(path.join(d, e.name))
          : e.name.endsWith('.js') && emDisco.push('/' + path.relative(PUBLIC, path.join(d, e.name)).split(path.sep).join('/')),
      );
  andar(path.join(PUBLIC, 'js'));
  assert.deepEqual([...lista].sort(), emDisco.sort(), 'nenhum módulo ficou de fora do cache offline');
  assert.ok(lista.includes('/js/main.js') && lista.includes('/js/telas/estante.js') && lista.includes('/js/views/estante.js'));
  assert.ok(fs.existsSync(path.join(destino, 'index.html')) && fs.existsSync(path.join(destino, 'icons', 'icon.svg')), 'copiou o resto do site');
});

test('build: não altera public/ e é repetível', () => {
  const antes = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');
  assert.match(antes, /const VERSAO = 'somaisumep-dev';/, 'no código-fonte a versão é "dev"');
  const destino = path.join(pasta(), 'dist');
  construir({ origem: PUBLIC, destino, sha: 'aaaaaaaaaa' });
  construir({ origem: PUBLIC, destino, sha: 'bbbbbbbbbb' });
  assert.match(fs.readFileSync(path.join(destino, 'sw.js'), 'utf8'), /somaisumep-bbbbbbbbbb/);
  assert.equal(fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8'), antes);
});

test('build: falha alto se o sw.js perder os marcadores (em vez de publicar sem versão)', () => {
  const origem = pasta();
  fs.mkdirSync(path.join(origem, 'js'));
  fs.writeFileSync(path.join(origem, 'sw.js'), '// sem marcadores');
  assert.throws(() => construir({ origem, destino: path.join(pasta(), 'dist'), sha: 'x' }), /sw\.js/);
});

test('sw.js: o service worker usa MODULOS no cache inicial', () => {
  const sw = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');
  assert.match(sw, /\.\.\.MODULOS,?\s*\]/); // o Prettier pode quebrar o array em várias linhas
  assert.ok(modulos(PUBLIC).length > 20);
});
