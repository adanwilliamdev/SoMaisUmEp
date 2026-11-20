// Testes de public/js/tmdbsync.js: a verificação automática não pode travar quando alguns títulos falham no TMDb.
// Um id removido do TMDb chega ao navegador como erro 502 (o servidor traduz qualquer falha do TMDb assim): sem carimbar a tentativa,
// esses títulos ficavam sempre no início da fila e, com `max` deles, nenhum outro título era atualizado.
globalThis.localStorage = (() => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() };
})();
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

const test = require('node:test');
const assert = require('node:assert/strict');
const { L } = require('../public/js/loja.js');
const { atualizarAutomatico } = require('../public/js/tmdbsync.js');

const DIA = 864e5;
const serie = (id, tmdb) => ({
  id,
  tipo: 'tv',
  nome: 'Série ' + id,
  tmdb,
  eps: [3],
  vis: [1],
  duracao: 40,
  nota: 8,
  sinopse: 's',
  capa: 'c',
  proximo: null,
  criado: 1,
});

function preparar(ids, ruins) {
  localStorage.clear();
  L.series = ids.map((id, i) => serie(id, 100 + i));
  const consultados = [];
  globalThis.fetch = async url => {
    const q = new URL(url, 'http://x').searchParams;
    const tmdb = Number(q.get('id'));
    consultados.push(tmdb);
    if (ruins.includes(tmdb)) return { status: 502, ok: false, json: async () => ({ erro: 'Não foi possível falar com o TMDb.' }) };
    return { status: 200, ok: true, json: async () => ({ tmdb, eps: [3], nums: [1], duracao: 40, nota: 8, sinopse: 's', poster: 'c', proximo: null }) };
  };
  return consultados;
}

test('título que falha no TMDb é carimbado e não bloqueia os outros na próxima abertura', async () => {
  const consultados = preparar(['a', 'b', 'c', 'd', 'e', 'f'], [100, 101, 102, 103]); // os 4 primeiros sempre falham
  await atualizarAutomatico({ max: 4 });
  assert.deepEqual(consultados, [100, 101, 102, 103], 'primeira abertura: tenta os 4 primeiros');

  consultados.length = 0;
  await atualizarAutomatico({ max: 4 });
  assert.deepEqual(consultados, [104, 105], 'segunda abertura: os que falharam ficam de fora e os outros são atualizados');
});

test('falha de rede continua interrompendo tudo, sem carimbar ninguém', async () => {
  preparar(['a', 'b'], []);
  let chamadas = 0;
  globalThis.fetch = async () => {
    chamadas++;
    throw new TypeError('fetch failed');
  };
  await atualizarAutomatico({ max: 4 });
  assert.equal(chamadas, 1, 'para na primeira falha de rede');
  assert.equal(localStorage.getItem('smue:upd'), null, 'nada foi carimbado: tenta de novo quando a rede voltar');
});

test('o carimbo da falha libera nova tentativa em cerca de 6 h, não só no dia seguinte', async () => {
  preparar(['a'], [100]);
  const antes = Date.now();
  await atualizarAutomatico({ max: 4 });
  const feitos = JSON.parse(localStorage.getItem('smue:upd'));
  const proxima = feitos.a + DIA; // volta a ser elegível quando agora - feitos > DIA
  const espera = proxima - antes;
  assert.ok(espera > 5.9 * 36e5 && espera < 6.1 * 36e5, `espera de ${(espera / 36e5).toFixed(2)} h`);
});
