// Acessibilidade (v5.2): contraste lido do CSS nos dois temas e conferências estáticas dos rótulos e do foco.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ler = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const css = ler('public/style.css');

const lum = h => {
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const razao = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const hex6 = h => (h.length === 4 ? '#' + [...h.slice(1)].map(c => c + c).join('') : h); // #fff -> #ffffff
const tokens = bloco => Object.fromEntries([...bloco.matchAll(/--([\w-]+):(#[0-9a-f]{3,6})\b/gi)].map(m => [m[1], hex6(m[2])]));
const claro = tokens(/:root\{[^}]*\}/.exec(css)[0]);
const escuro = tokens(/:root\[data-theme="dark"\]\{[^}]*\}/.exec(css)[0]);

for (const [nome, t] of [
  ['claro', claro],
  ['escuro', escuro],
]) {
  test(`contraste (${nome}): texto >= 4,5:1 e bordas de controles >= 3:1`, () => {
    const texto = [
      ['tx', 'bg'],
      ['tx', 'card'],
      ['mut', 'bg'],
      ['mut', 'rail'],
      ['mut', 'card'],
      ['mut', 'card2'],
      ['on', 'acc'],
      ['on-ok', 'ok'],
      ['acc', 'bg'],
      ['acc', 'card'],
      ['perigo', 'bg'],
      ['perigo', 'card'],
    ];
    for (const [f, b] of texto) assert.ok(razao(t[f], t[b]) >= 4.5, `${f} sobre ${b} = ${razao(t[f], t[b]).toFixed(2)}`);
    for (const b of ['bg', 'rail', 'card', 'card2']) assert.ok(razao(t.ctl, t[b]) >= 3, `--ctl sobre ${b} = ${razao(t.ctl, t[b]).toFixed(2)}`);
  });
}

test('foco e bordas: campos não perdem o contorno no alto contraste; controles usam --ctl; nada de opacidade nos textos de apoio', () => {
  assert.match(css, /input:focus,textarea:focus,select:focus\{outline:2px solid transparent/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.btn\.sec\{[^}]*border-color:var\(--ctl\)/);
  assert.match(css, /input\[type=text\][^{]*\{[^}]*border:1px solid var\(--ctl\)/, 'campos de formulário usam --ctl');
  assert.match(css, /\.chip\{[^}]*border:1px solid var\(--line\)/, 'chips têm texto visível: a borda é só decorativa');
  assert.match(css, /::placeholder\{color:var\(--mut\);opacity:1\}/);
  assert.doesNotMatch(css, /\.n\{[^}]*opacity/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors:active/);
});

test('index.html: pular para o conteúdo, área principal focável e região de anúncios para leitor de tela', () => {
  const h = ler('public/index.html');
  assert.match(h, /<html lang="pt-BR"/);
  assert.match(h, /data-act="pular"/);
  assert.match(h, /<main id="app" tabindex="-1">/);
  assert.match(h, /id="anuncio"[^>]*aria-live="polite"/);
});

test('views: botões só com ícone têm nome, episódios dizem a temporada, tops têm subir/descer e o gráfico tem tabela', async () => {
  const V = await import('../public/js/views.js');
  const { L } = await import('../public/js/loja.js');
  const s = { id: 's1', tipo: 'tv', nome: 'Série', eps: [3, 2], vis: [1, 0], criado: 1, hist: {} };
  L.series = [s, { ...s, id: 's2', nome: 'Outra' }];
  L.tops = [
    {
      id: 't1',
      nome: 'Top',
      itens: [
        { t: 'Série', sid: 's1' },
        { t: 'Outra', sid: 's2' },
      ],
      criado: 1,
    },
  ];
  L.links = {};
  // As views devolvem um Html (String estendida); os asserts de regex pedem string primitiva.
  const det = String(V.htmlDetalhe(s, null));
  assert.match(det, /aria-label="Temporada 2, episódio 1"/);
  assert.match(det, /aria-label="Marcar toda a temporada 2"/);
  assert.match(det, /aria-label="Zerar temporada 1"/);
  const tops = String(V.viewTops());
  assert.match(tops, /data-act="sobe"[^>]*disabled/, 'o primeiro item não sobe');
  assert.match(tops, /data-act="desce"[^>]*aria-label="Descer Série \(posição 1 de 2\)"/);
  assert.match(tops, /aria-keyshortcuts="ArrowUp ArrowDown Home End"/);
  const g = String(V.graficoMeses([{ rotulo: 'Jan', ano: 2026, valor: 4, mes: '2026-01' }]));
  assert.match(g, /<table class="sr"><caption>/);
  assert.match(g, /<th scope="row">Jan\/2026<\/th><td>4<\/td>/);
  // todo <button> renderizado tem texto visível ou aria-label
  for (const doc of [det, tops]) {
    for (const m of doc.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const texto = m[2]
        .replace(/<svg[\s\S]*?<\/svg>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim();
      assert.ok(/aria-label=/.test(m[1]) || texto, 'botão sem nome: ' + m[0].slice(0, 90));
    }
  }
});

test('campos de arquivo escondidos só visualmente (nunca com hidden) e diálogo com nome acessível', () => {
  for (const f of ['public/js/views/importar.js', 'public/js/telas/backup.js']) {
    assert.doesNotMatch(ler(f), /type="file"[^>]*\bhidden\b/, f);
    assert.match(ler(f), /class="sr-input"/, f);
  }
  assert.match(ler('public/js/telas/ctx.js'), /aria-labelledby/);
});

test('painel de detalhes: a capa da miniatura preenche a caixa (sem recorte em tamanho real) e clicar fora fecha', () => {
  assert.match(css, /\.cab \.mini-capa img\{[^}]*width:100%[^}]*height:100%[^}]*object-fit:cover/);
  const ctx = ler('public/js/telas/ctx.js');
  assert.match(ctx, /dlg\.addEventListener\('click'/);
  assert.match(ctx, /!dlg\.querySelector\('form'\)/); // painéis com formulário não fecham por clique fora
});
