// mesclarTitulo (regras.js): combina a cópia deste aparelho (loc) com a do servidor (srv) quando os dois mudaram.
const test = require('node:test');
const assert = require('node:assert/strict');

const M = () => import('../public/js/regras.js').then(m => m.mesclarTitulo);
const base = extra => ({ id: 'a', tipo: 'tv', nome: 'S', eps: [3, 3], vis: [0, 0], criado: 1, hist: {}, ...extra });

test('mesclar: sem versão do servidor, vale a local (o mesmo objeto)', async () => {
  const loc = base();
  assert.equal((await M())(loc, null), loc);
});

test('mesclar: mesmas temporadas: o maior progresso de cada temporada vence', async () => {
  const mesclar = await M();
  const m = mesclar(base({ vis: [3, 1] }), base({ vis: [2, 3] }));
  assert.deepEqual(m.vis, [3, 3]);
});

test('mesclar: temporadas diferentes (o título mudou no TMDb ou foi editado): as temporadas são as do servidor e o progresso local não se perde', async () => {
  const mesclar = await M();
  const m = mesclar(base({ eps: [3, 3], vis: [3, 3] }), base({ eps: [3, 3, 8], vis: [1, 0, 0] }));
  assert.deepEqual(m.eps, [3, 3, 8]);
  assert.deepEqual(m.vis, [3, 3, 0]);
});

test('mesclar: progresso local nunca passa do tamanho da temporada do servidor', async () => {
  const mesclar = await M();
  const m = mesclar(base({ eps: [10], vis: [10] }), base({ eps: [8], vis: [2] }));
  assert.deepEqual(m.vis, [8]);
});

test('mesclar: progresso local curto demais (undefined) conta como zero', async () => {
  const mesclar = await M();
  const m = mesclar(base({ vis: [2] }), base({ vis: [0, 1] }));
  assert.deepEqual(m.vis, [2, 1]);
});

test('mesclar: histórico mensal fica com o maior valor de cada mês; visto_em com o mais recente', async () => {
  const mesclar = await M();
  const m = mesclar(base({ hist: { '2026-09': 4, '2026-10': 1 }, visto_em: 200 }), base({ hist: { '2026-10': 3, '2026-11': 2 }, visto_em: 100 }));
  assert.deepEqual(m.hist, { '2026-09': 4, '2026-10': 3, '2026-11': 2 });
  assert.equal(m.visto_em, 200);
  assert.equal(mesclar(base(), base()).visto_em, null, 'sem nenhum dos dois: null');
});

test('mesclar: nota e resenha locais só entram se o servidor não tiver; a do servidor vence', async () => {
  const mesclar = await M();
  const so_local = mesclar(base({ nota_pessoal: 8, resenha: 'bom' }), base());
  assert.equal(so_local.nota_pessoal, 8);
  assert.equal(so_local.resenha, 'bom');
  const dos_dois = mesclar(base({ nota_pessoal: 8, resenha: 'bom' }), base({ nota_pessoal: 5, resenha: 'ruim' }));
  assert.equal(dos_dois.nota_pessoal, 5);
  assert.equal(dos_dois.resenha, 'ruim');
  const zero = mesclar(base({ nota_pessoal: 0 }), base());
  assert.equal(zero.nota_pessoal, 0, 'nota 0 é nota (não confunde com vazio)');
});

test('mesclar: metadados (nome, capa, próximo) vêm do servidor', async () => {
  const mesclar = await M();
  const m = mesclar(base({ nome: 'Antigo', capa: 'https://x/a.jpg' }), base({ nome: 'Novo', capa: 'https://x/b.jpg', proximo: { d: '2026-12-01' } }));
  assert.equal(m.nome, 'Novo');
  assert.equal(m.capa, 'https://x/b.jpg');
  assert.deepEqual(m.proximo, { d: '2026-12-01' });
});

test('mesclar: não altera os objetos recebidos e é idempotente', async () => {
  const mesclar = await M();
  const loc = base({ vis: [3, 0], hist: { '2026-10': 1 } }),
    srv = base({ vis: [1, 2], hist: { '2026-10': 2 } });
  const antes = JSON.stringify([loc, srv]);
  const m = mesclar(loc, srv);
  assert.equal(JSON.stringify([loc, srv]), antes);
  assert.deepEqual(mesclar(m, srv), m);
});
