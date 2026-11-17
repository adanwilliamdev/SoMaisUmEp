// Testes das melhorias: histórico ao desmarcar, "já vi antes", situação (pausada/abandonada), migração 007,
// validação no servidor, sync incremental (?desde) e agrupamento da estante.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const R = () => import('../public/js/regras.js');
const serie = (o = {}) => ({ id: 'a', tipo: 'tv', nome: 'Série', eps: [10, 8], vis: [0, 0], criado: 1, ...o });
const out = new Date(2026, 9, 10, 12).getTime(),
  nov = new Date(2026, 10, 5, 12).getTime();

test('registrarProgresso: desmarcar em outro mês tira do mês em que o episódio foi contado', async () => {
  const { registrarProgresso, vis } = await R();
  const s = serie({ vis: [0, 0] });
  s.vis[0] = 3;
  registrarProgresso(s, 0, out);
  assert.deepEqual(s.hist, { '2026-10': 3 });
  const a = vis(s);
  s.vis[0] = 2; // desmarca um, já em novembro
  registrarProgresso(s, a, nov);
  assert.deepEqual(s.hist, { '2026-10': 2 }, 'sai de outubro; novembro não fica negativo nem some nada à toa');
});

test('registrarProgresso: desmarcar vários passa para os meses anteriores quando o mais recente acaba', async () => {
  const { registrarProgresso } = await R();
  const s = serie({ vis: [5, 0], hist: { '2026-09': 3, '2026-10': 1, '2026-11': 1 } });
  s.vis[0] = 1; // −4
  registrarProgresso(s, 5, nov);
  assert.deepEqual(s.hist, { '2026-09': 1 });
});

test('registrarProgresso: retroativo não conta como atividade nem muda "último visto"', async () => {
  const { registrarProgresso } = await R();
  const s = serie({ vis: [0, 0], visto_em: 50, hist: { '2026-10': 2 } });
  s.vis[0] = 10;
  registrarProgresso(s, 0, nov, { retroativo: true });
  assert.deepEqual(s.hist, { '2026-10': 2 });
  assert.equal(s.visto_em, 50);
  assert.equal(s.vis[0], 10, 'o progresso em si fica');
});

test('situação: pausada/abandonada saem de "Continuar assistindo" e viram grupo próprio; concluído vence', async () => {
  const { situacao, estadoLista, rotulo, continuar, filtrar } = await R();
  const a = serie({ id: '1', vis: [3, 0], situacao: 'pausada' }),
    b = serie({ id: '2', vis: [3, 0], situacao: 'abandonada' }),
    c = serie({ id: '3', vis: [3, 0] }),
    d = serie({ id: '4', vis: [10, 8], situacao: 'pausada' });
  assert.equal(situacao(a), 'pausada');
  assert.equal(situacao(d), null, 'quem terminou não está pausado');
  assert.equal(estadoLista(b), 'abandonada');
  assert.equal(estadoLista(d), 'fim');
  assert.equal(rotulo(a), 'Pausada · T1 E4');
  assert.deepEqual(
    continuar([a, b, c, d]).map(s => s.id),
    ['3'],
  );
  assert.deepEqual(
    filtrar([a, b, c], { estado: 'pausada' }).map(s => s.id),
    ['1'],
  );
  assert.deepEqual(
    filtrar([a, b, c], { estado: 'assistindo' }).map(s => s.id),
    ['3'],
  );
});

test('situação: marcar um episódio de verdade volta ao normal', async () => {
  const { registrarProgresso } = await R();
  const s = serie({ vis: [3, 0], situacao: 'pausada' });
  s.vis[0] = 4;
  registrarProgresso(s, 3, nov);
  assert.equal(s.situacao, null);
});

test('backup: situação inválida vira null e a válida é mantida', async () => {
  const { limparTituloBackup: lt } = await R();
  const base = { id: 'x', nome: 'N', eps: [2], vis: [1] };
  assert.equal(lt({ ...base, situacao: 'pausada' }).situacao, 'pausada');
  assert.equal(lt({ ...base, situacao: '<script>' }).situacao, null);
});

test('servidor: _validar aceita só pausada/abandonada', () => {
  const V = require('../api/_validar');
  const t = s => V.titulo({ id: 'a', eps: [2], vis: [0], situacao: s }, 'u');
  assert.equal(t('pausada').situacao, 'pausada');
  assert.equal(t('abandonada').situacao, 'abandonada');
  assert.equal(t('qualquer').situacao, null);
  assert.equal(t(undefined).situacao, null);
});

test('migração 007: orfãos, NOT NULL, chave primária, faixa das notas e situação; schema.sql em dia', () => {
  const dir = path.join(__dirname, '..', 'neon');
  const m = fs.readFileSync(path.join(dir, 'migracoes', '007_integridade_e_situacao.sql'), 'utf8');
  assert.match(m, /alter table titulos add primary key \(user_id, id\)/);
  assert.match(m, /alter table tops add primary key \(user_id, id\)/);
  assert.match(m, /user_id is null and exists \(select 1 from usuarios\)/, 'só apaga orfãos quando já há contas');
  assert.match(m, /alter column user_id set not null/);
  assert.match(m, /titulos_nota_faixa/);
  assert.match(m, /add column if not exists situacao text/);
  assert.match(m, /situacao in \('pausada', 'abandonada'\)/);
  assert.match(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'), /'007_integridade_e_situacao'/);
});

test('sync: o upsert grava a situação', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'api', '_h', 'sync.js'), 'utf8');
  assert.match(src, /situacao = excluded\.situacao/);
});
