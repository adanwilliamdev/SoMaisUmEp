// html``: escape automático. E uma trava que impede voltar a montar HTML com texto de fora sem passar por ele.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MAU = '"><img src=x onerror=alert(1)>';
const ESCAPADO = '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;';

test('html: tudo o que entra em ${} é escapado, em texto e em atributo', async () => {
  const { html } = await import('../public/js/util.js');
  assert.equal(String(html`<a title="${MAU}">${MAU}</a>`), `<a title="${ESCAPADO}">${ESCAPADO}</a>`);
  assert.equal(String(html`${"Tom & 'Jerry'"}`), 'Tom &amp; &#39;Jerry&#39;');
  assert.equal(String(html`${0}|${'x'}`), '0|x');
});

test('html: null e undefined somem; booleanos saem como texto (aria-pressed precisa de "false")', async () => {
  const { html } = await import('../public/js/util.js');
  assert.equal(String(html`[${null}][${undefined}]`), '[][]');
  assert.equal(String(html`<button aria-pressed="${false}"></button>`), '<button aria-pressed="false">');
  assert.equal(String(html`<button aria-pressed="${true}"></button>`), '<button aria-pressed="true">');
});

test('html: trechos html``/raw() entram sem novo escape e listas são juntadas', async () => {
  const { html, raw } = await import('../public/js/util.js');
  const li = ['a<', 'b'].map(x => html`<li>${x}</li>`);
  assert.equal(
    String(
      html`<ul>
        ${li}
      </ul>`,
    ),
    '<ul><li>a&lt;</li><li>b</li></ul>',
  );
  assert.equal(String(html`${html`<b>${'&'}</b>`}`), '<b>&amp;</b>');
  assert.equal(String(html`${raw('<i>ok</i>')}`), '<i>ok</i>');
  assert.equal(String(html`${[raw('<b>1</b>'), '<2>']}`), '<b>1</b>&lt;2&gt;');
});

test('html: um texto comum com cara de HTML nunca vira marcação, mesmo dentro de lista ou de outro html``', async () => {
  const { html } = await import('../public/js/util.js');
  const texto = '<script>alert(1)</script>';
  const fora = html`<div>${[texto, html`<p>${texto}</p>`]}</div>`;
  assert.doesNotMatch(String(fora), /<script>/);
  assert.equal((String(fora).match(/&lt;script&gt;/g) || []).length, 2);
});

test('html: o resultado serve como string (innerHTML, concatenação e length)', async () => {
  const { html } = await import('../public/js/util.js');
  const h = html`<p>${'x'}</p>`;
  assert.equal(h.length, 8);
  assert.equal(`${h}`, '<p>x</p>');
  assert.equal(h + '!', '<p>x</p>!');
  assert.equal(h instanceof String, true);
});

/* ---------- trava: nada de innerHTML montado à mão com ${} ---------- */
const lista = dir =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? lista(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
const ARQUIVOS = lista(path.join(__dirname, '../public/js'));

test('trava: innerHTML/insertAdjacentHTML nunca recebem template com ${} sem html``', () => {
  const ruins = [];
  for (const f of ARQUIVOS) {
    const src = fs.readFileSync(f, 'utf8');
    // atribuição (=, +=) ou insertAdjacentHTML(pos, ...) seguidos de um template literal sem o prefixo html
    for (const m of src.matchAll(/(?:innerHTML\s*\+?=\s*|insertAdjacentHTML\([^,]+,\s*)`([^`]*)`/g))
      if (m[1].includes('${')) ruins.push(path.relative(process.cwd(), f) + ': ' + m[0].slice(0, 70));
  }
  assert.deepEqual(ruins, [], 'use html`...` (escapa sozinho) em vez de template comum');
});

test('trava: innerHTML nunca recebe concatenação de strings (+) nem esc() manual', () => {
  const ruins = [];
  for (const f of ARQUIVOS) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/innerHTML\s*\+?=\s*([^;\n]*)/g))
      if (/['"`]\s*\+|\+\s*['"`]/.test(m[1])) ruins.push(path.relative(process.cwd(), f) + ': ' + m[0].slice(0, 70));
    if (/\besc\(/.test(src.replace(/^export const esc = .*$/m, '')) && !f.endsWith('util.js'))
      ruins.push(path.relative(process.cwd(), f) + ': esc() manual (use html``)');
  }
  assert.deepEqual(ruins, []);
});

// Lê um literal de texto ('...' ou "...") em src a partir de i; devolve o índice logo depois dele, ou -1 se não começa por um literal.
const fimLiteral = (src, i) => {
  while (src[i] === ' ') i++;
  const q = src[i];
  if (q !== "'" && q !== '"') return -1;
  for (i++; i < src.length && src[i] !== q; i++) if (src[i] === '\\') i++;
  return i + 1;
};
test('trava: raw() só recebe texto fixo (literal, ou condicional entre dois literais), nunca uma variável de dados', () => {
  const ruins = [];
  for (const f of ARQUIVOS.filter(f => !f.endsWith('util.js'))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\braw\(/g)) {
      let i = fimLiteral(src, m.index + m[0].length);
      if (i < 0) {
        // condicional: raw(condicao ? 'a' : 'b')
        const q = src.indexOf('?', m.index);
        i = q > 0 && q - m.index < 40 ? fimLiteral(src, q + 1) : -1;
        if (i > 0) {
          while (src[i] === ' ') i++;
          i = src[i] === ':' ? fimLiteral(src, i + 1) : -1;
        }
      }
      while (i > 0 && src[i] === ' ') i++;
      if (i < 0 || src[i] !== ')') ruins.push(path.relative(process.cwd(), f) + ': ' + src.slice(m.index, m.index + 60).replace(/\n/g, ' '));
    }
  }
  assert.deepEqual(ruins, [], 'raw() é só para HTML fixo escrito no código');
});

/* ---------- XSS nas views que o teste antigo não cobria ---------- */
test('views: texto malicioso é escapado também em importar, conta, "onde assistir", notas dos tops e radar', async () => {
  const V = await import('../public/js/views.js');
  const { L } = await import('../public/js/loja.js');
  L.series = [];
  L.tops = [];
  L.links = {};
  const onde = { assinatura: [{ nome: MAU, logo: MAU }], gratis: [], alugar: [{ nome: MAU, logo: null }], comprar: null, link: MAU };
  const radar = { dna: { generos: [{ nome: MAU, n: 2 }] }, resultados: [{ id: 5, nome: MAU, ano: MAU, nota: 8, poster: MAU, onde: [MAU], porque: [] }] };
  const saidas = {
    onde: V.htmlOnde(onde),
    importarPrevia: V.htmlImportar({ previa: { filmesVistos: 1, filmesFila: 0, series: 0, episodios: 0, seriesSemProgresso: 0 }, fontes: [MAU] }),
    importarAndamento: V.htmlImportar({ andamento: { pct: 10, texto: MAU } }),
    importarFim: V.htmlImportar({ fim: { novos: 0, repetidos: 0, naoAchou: [MAU, MAU], parou: false } }),
    formEmail: V.viewFormConta('email', MAU),
    obs: V.htmlObs({ t: MAU, obs: MAU }),
    obsCampo: V.htmlObsCampo({ t: MAU, obs: MAU }),
    descobrirErro: V.htmlDescobrir('tv', { radar: 'erro', erro: MAU }),
    descobrirSemLigacao: V.htmlDescobrir('tv', { radar: null, sementes: [], semLigacao: [MAU] }),
    descobrirRadar: V.htmlDescobrir('tv', { radar, sementes: [{ id: 'x', tipo: 'tv', nome: MAU, eps: [1], vis: [1], tmdb: 1, nota_pessoal: 9 }] }),
    descDetalhe: V.htmlDescDetalhe({ id: MAU, nome: MAU, ano: MAU, poster: MAU, sinopse: MAU }, 'tv', onde),
    capa: V.capa(MAU, MAU),
  };
  for (const [nome, h] of Object.entries(saidas)) {
    const doc = String(h);
    assert.ok(doc.length > 20, nome + ' gerou HTML');
    assert.doesNotMatch(doc, /<img src=x/i, nome + ' deixou o HTML escapar');
    assert.doesNotMatch(doc, /"\s*onerror=/i, nome + ' deixou um atributo escapar');
  }
});
