// Garante que ids e textos vindos de fora (backup importado, cópia local, TMDb) nunca viram marcação HTML.
// views.js/loja.js só precisam de localStorage e document; aqui são substituídos por versões vazias.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };

const test = require('node:test');
const assert = require('node:assert/strict');

const MAU = '"><img src=x onerror=alert(1)>';

test('views: id malicioso é escapado em todo atributo (cards, detalhe, tops, compartilhar, descobrir)', async () => {
  const V = await import('../public/js/views.js');
  const { L } = await import('../public/js/loja.js');
  const s = { id: MAU, tipo: 'tv', nome: 'S', eps: [3], vis: [1], criado: 1, hist: {} };
  L.series = [s]; L.tops = [{ id: MAU, nome: 'T', itens: [{ t: 'S', sid: MAU }], criado: 1 }]; L.links = {};
  const tmdb = { id: MAU, nome: 'D', ano: '2020', poster: null };
  const saidas = {
    cardHtml: V.cardHtml(s, 0), cardContinuar: V.cardContinuar(s, 0), htmlDetalhe: V.htmlDetalhe(s, null), viewTops: V.viewTops(),
    htmlCompartilhar: V.htmlCompartilhar(L.tops[0], null, ''), htmlDescobrir: V.htmlDescobrir('tv', { alta: [tmdb], parecidos: [] }),
    htmlDescDetalhe: V.htmlDescDetalhe(tmdb, 'tv', null),
  };
  for (const [nome, html] of Object.entries(saidas)) {
    assert.ok(html.length > 50, nome + ' gerou HTML');
    assert.doesNotMatch(html, /<img src=x/i, nome + ' deixou o HTML do id escapar');
  }
});
