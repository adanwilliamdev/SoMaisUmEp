const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../api/_validar');
const { bloqueioMs } = require('../api/_limite');

const UID = '11111111-2222-3333-4444-555555555555';

test('título: normaliza, limita e corta progresso acima do total', () => {
  const t = V.titulo({ id: 'abc', nome: '  Minha série  ', eps: [10, '8', -3, 5000], vis: [20, 2], nota: 15, nota_pessoal: '8.76', base: '123' }, UID);
  assert.equal(t.nome, 'Minha série');
  assert.deepEqual(t.eps, [10, 8, 1, 999]);
  assert.deepEqual(t.vis, [10, 2, 0, 0]);
  assert.equal(t.nota, 10);
  assert.equal(t.nota_pessoal, 8.8);
  assert.equal(t.base, 123);
  assert.equal(t.tipo, 'tv');
});

test('título: filme sempre tem 1 "episódio"; série sem temporadas é rejeitada', () => {
  assert.deepEqual(V.titulo({ id: 'f1', tipo: 'movie', nome: 'F', eps: [99], vis: [5] }, UID).eps, [1]);
  assert.deepEqual(V.titulo({ id: 'f1', tipo: 'movie', nome: 'F', eps: [99], vis: [5] }, UID).vis, [1]);
  assert.throws(() => V.titulo({ id: 'x', eps: [] }, UID), /sem temporadas/);
  assert.throws(() => V.titulo({ id: 'id inválido!', eps: [1] }, UID), /inválido/);
  assert.throws(() => V.titulo(null, UID));
});

test('capas: só TMDb, JPEG pequeno ou Blob do próprio usuário', () => {
  assert.ok(V.capaOk('https://image.tmdb.org/t/p/w342/a.jpg', UID));
  assert.ok(V.capaOk('data:image/jpeg;base64,/9j/4AAQ', UID));
  assert.ok(V.capaOk(`https://abc123.public.blob.vercel-storage.com/capas/${UID}/capa-x1.jpg`, UID));
  assert.equal(V.capaOk('https://abc123.public.blob.vercel-storage.com/capas/outro-usuario/capa.jpg', UID), null);
  assert.equal(V.capaOk('https://evil.example/a.jpg', UID), null);
  assert.equal(V.capaOk('data:image/svg+xml;base64,AAAA', UID), null);
  assert.equal(V.capaOk('data:image/jpeg;base64,' + 'A'.repeat(130000), UID), null);
});

test('histórico: só meses válidos e contagens inteiras', () => {
  assert.deepEqual(V.historico({ '2026-11': 3, '2026-13': 2, 'x': 1, '2026-10': -4, '2026-09': '7' }), { '2026-11': 3, '2026-09': 7 });
  assert.deepEqual(V.historico([1, 2]), {});
  assert.deepEqual(V.historico(null), {});
});

test('top: máximo de 10 itens e ids de título válidos', () => {
  const t = V.top({ id: 't1', nome: 'Top', itens: Array.from({ length: 14 }, (_, i) => ({ t: 'Item ' + i, sid: i === 0 ? 'ok-1' : 'ruim!' })) });
  assert.equal(t.itens.length, 10);
  assert.equal(t.itens[0].sid, 'ok-1');
  assert.equal(t.itens[1].sid, undefined);
  assert.throws(() => V.top({ id: '' }));
});

test('ids: filtra e limita', () => {
  assert.deepEqual(V.ids(['a', 'b c', 5, 'ok-2']), ['a', 'ok-2']);
  assert.deepEqual(V.ids('x'), []);
});

test('e-mail e senha', () => {
  assert.equal(V.email('  Ana@Exemplo.COM '), 'ana@exemplo.com');
  assert.throws(() => V.email('sem-arroba'), /e-mail/);
  assert.throws(() => V.email(''), /e-mail/);
  assert.equal(V.senha('12345678'), '12345678');
  assert.throws(() => V.senha('curta'), /8 caracteres/);
  assert.throws(() => V.nomeUsuario('   '), /nome/);
});

test('bloqueio de login: sobe com as falhas e tem teto', () => {
  assert.equal(bloqueioMs(1), 0);
  assert.equal(bloqueioMs(4), 0);
  assert.equal(bloqueioMs(5), 15 * 60e3);
  assert.equal(bloqueioMs(8), 30 * 60e3);
  assert.equal(bloqueioMs(500), 24 * 60 * 60e3);
  assert.equal(bloqueioMs(19, 20), 0);
  assert.equal(bloqueioMs(20, 20), 15 * 60e3);
});
