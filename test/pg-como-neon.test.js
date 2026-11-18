// O adaptador dos testes de integração (Postgres comum fingindo ser o driver do Neon). Aqui com um `pool` falso,
// só para garantir a mecânica; os testes contra o banco de verdade ficam em integracao/.
const test = require('node:test');
const assert = require('node:assert/strict');
const { criarSql } = require('../integracao/pg-como-neon');

const poolFalso = ({ falharEm = null } = {}) => {
  const chamadas = [],
    cli = {
      query: async (texto, valores) => {
        chamadas.push(['cli', texto, valores]);
        if (falharEm && texto.includes(falharEm)) throw new Error('falhou: ' + falharEm);
        return { rows: [{ texto }] };
      },
      release: () => chamadas.push(['release']),
    };
  return {
    chamadas,
    query: async (texto, valores) => {
      chamadas.push(['pool', texto, valores]);
      return { rows: [{ ok: 1 }] };
    },
    connect: async () => cli,
  };
};

test('adaptador: o template vira texto com $1, $2... e a consulta só executa quando recebe await', async () => {
  const pool = poolFalso(),
    sql = criarSql(pool);
  const q = sql`select * from t where a = ${'x'} and b = ${[1, 2]}`;
  assert.equal(q.text, 'select * from t where a = $1 and b = $2');
  assert.deepEqual(q.values, ['x', [1, 2]]);
  assert.equal(pool.chamadas.length, 0, 'preguiçosa: nada executou ainda');
  assert.deepEqual(await q, [{ ok: 1 }]);
  assert.deepEqual(pool.chamadas, [['pool', 'select * from t where a = $1 and b = $2', ['x', [1, 2]]]]);
});

test('adaptador: undefined vira null e comando de texto puro (usado em scripts/migrar.js) não leva parâmetros', async () => {
  const pool = poolFalso(),
    sql = criarSql(pool);
  assert.deepEqual(sql`x ${undefined} y`.values, [null]);
  await sql(Object.assign(['create table a (id int)'], { raw: ['create table a (id int)'] }));
  assert.deepEqual(pool.chamadas[0], ['pool', 'create table a (id int)', []]);
});

test('adaptador: transaction executa tudo entre begin e commit, na mesma conexão, e devolve as linhas de cada consulta', async () => {
  const pool = poolFalso(),
    sql = criarSql(pool);
  const saida = await sql.transaction([sql`insert a ${1}`, sql`insert b ${2}`]);
  assert.deepEqual(
    pool.chamadas.map(c => c[1] || c[0]),
    ['begin', 'insert a $1', 'insert b $1', 'commit', 'release'],
  );
  assert.equal(saida.length, 2);
  assert.deepEqual(saida[1], [{ texto: 'insert b $1' }]);
});

test('adaptador: se uma consulta da transação falha, faz rollback, solta a conexão e repassa o erro (tudo ou nada)', async () => {
  const pool = poolFalso({ falharEm: 'insert b' }),
    sql = criarSql(pool);
  await assert.rejects(() => sql.transaction([sql`insert a ${1}`, sql`insert b ${2}`]), /falhou: insert b/);
  const ordem = pool.chamadas.map(c => c[1] || c[0]);
  assert.deepEqual(ordem, ['begin', 'insert a $1', 'insert b $1', 'rollback', 'release']);
  assert.ok(!ordem.includes('commit'));
});
