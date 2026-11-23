// Refinamentos de usabilidade: busca sem resultado leva a adicionar o título, "Mostrar senha" nos formulários,
// filtro da estante lembrado e Desfazer ao excluir um título.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ler = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('estante: busca sem resultado oferece adicionar o título buscado (escapado) na aba certa', async () => {
  const { UI } = await import('../public/js/views/comum.js');
  const { htmlLista } = await import('../public/js/views/estante.js');
  const { L } = await import('../public/js/loja.js');
  L.series = [{ id: 'a', tipo: 'tv', nome: 'Outra', eps: [1], vis: [0], criado: 1 }];
  UI.filtro = 'todas';
  UI.busca = 'Dune "Parte" <b>';
  const tv = String(htmlLista('tv')),
    mv = String(htmlLista('movie'));
  assert.match(tv, /data-act="nova" data-tipo="tv" data-nome="Dune &quot;Parte&quot; &lt;b&gt;"/);
  assert.match(tv, /Adicionar esta série/);
  assert.match(mv, /data-tipo="movie"/);
  assert.match(mv, /Adicionar este filme/);
  assert.doesNotMatch(tv, /<b>"|<b>'/, 'o texto buscado não entra como HTML');
  UI.busca = '';
});

test('formulário: o nome vindo da busca preenche o nome e a busca do TMDb, limitado a 80 caracteres', () => {
  const f = ler('public/js/telas/formulario.js');
  assert.match(f, /formSerie\(null, b\.dataset\.tipo, \(b\.dataset\.nome \|\| ''\)\.slice\(0, 80\)\)/);
  assert.match(f, /value="\$\{s \? s\.nome : nomeInicial\}"/);
  assert.match(f, /id="tq" value="\$\{s \? '' : nomeInicial\}"/);
});

test('entrar, criar conta, nova senha e formulários da conta têm "Mostrar senha"', async () => {
  const { viewAuth, viewRedefinir, viewFormConta, viewEsqueci } = await import('../public/js/views/conta.js');
  const tem = h => /data-act="ver-senha" aria-pressed="false">Mostrar senha</.test(String(h));
  assert.ok(tem(viewAuth('entrar')));
  assert.ok(tem(viewAuth('criar')));
  assert.ok(tem(viewRedefinir()));
  for (const a of ['senha', 'email', 'excluir']) assert.ok(tem(viewFormConta(a)), a);
  assert.ok(!tem(viewEsqueci()), 'recuperar senha só pede o e-mail');
});

test('"Mostrar senha" alterna todos os campos de senha do formulário e o rótulo do botão', async () => {
  const { alternarSenha } = await import('../public/js/util.js');
  const campos = [{ type: 'password' }, { type: 'password' }];
  const attrs = { 'aria-pressed': 'false' };
  const b = {
    textContent: 'Mostrar senha',
    getAttribute: k => attrs[k],
    setAttribute: (k, v) => (attrs[k] = v),
    closest: () => ({ querySelectorAll: sel => (sel === 'input[autocomplete$="password"]' ? campos : []) }),
  };
  alternarSenha(b);
  assert.deepEqual(
    campos.map(c => c.type),
    ['text', 'text'],
  );
  assert.equal(b.textContent, 'Ocultar senha');
  assert.equal(attrs['aria-pressed'], 'true');
  alternarSenha(b);
  assert.deepEqual(
    campos.map(c => c.type),
    ['password', 'password'],
  );
  assert.equal(b.textContent, 'Mostrar senha');
  assert.equal(attrs['aria-pressed'], 'false');
});

test('"Mostrar senha": ação registrada e estilo existente', () => {
  assert.match(ler('public/js/telas/conta.js'), /'ver-senha': \(\{ b \}\) => alternarSenha\(b\)/);
  assert.match(ler('public/style.css'), /\.mostrar-linha\{/);
});

test('filtro da estante é lembrado entre sessões e volta a "Todas" depois de adicionar ou importar', () => {
  assert.match(ler('public/js/views/comum.js'), /filtro: ler\('smue:filtro', 'todas'\)/);
  assert.match(ler('public/js/telas/estante.js'), /guardar\('smue:filtro', V\.UI\.filtro\)/);
  assert.match(ler('public/js/telas/formulario.js'), /guardar\('smue:filtro', 'todas'\)/);
  assert.match(ler('public/js/telas/importar.js'), /guardar\('smue:filtro', 'todas'\)/);
});

test('excluir título: oferece Desfazer, devolve na mesma posição e religa os itens dos tops', () => {
  const d = ler('public/js/telas/detalhe.js');
  assert.match(d, /avisoDesfazer\(\s*`\$\{s\.nome\} excluído`/);
  assert.match(d, /L\.series\.splice\(Math\.min\(pos, L\.series\.length\), 0, s\)/);
  assert.match(d, /it\.sid = s\.id/);
});

test('tops: o mesmo título não entra duas vezes no mesmo ranking', () => {
  assert.match(ler('public/js/telas/tops.js'), /já está neste top/);
});
