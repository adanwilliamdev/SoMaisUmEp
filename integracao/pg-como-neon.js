// Faz um Postgres comum (pacote `pg`) responder como o driver do Neon (`neon(url)`), para rodar os handlers de api/ contra um
// banco de verdade sem mudar uma linha deles. Só cobre o que o projeto usa:
//   sql`select ... ${valor}`            -> consulta preguiçosa: só executa quando recebe `await` (ou entra em sql.transaction)
//   sql.transaction([q1, q2, ...])      -> BEGIN ... COMMIT numa única conexão, devolvendo as linhas de cada consulta
//   sql(Object.assign([texto], { raw: [texto] }))  -> comando de texto puro (usado por scripts/migrar.js)
const Module = require('node:module');

function criarSql(pool) {
  const preparar = (partes, valores) => ({
    text: partes.reduce((t, p, i) => t + '$' + i + p),
    values: valores.map(v => (v === undefined ? null : v)),
  });
  const sql = (partes, ...valores) => {
    const q = preparar(partes, valores);
    return { ...q, then: (ok, no) => pool.query(q.text, q.values).then(r => r.rows).then(ok, no) };
  };
  sql.transaction = async consultas => {
    const cli = await pool.connect();
    try {
      await cli.query('begin');
      const saida = [];
      for (const q of consultas) saida.push((await cli.query(q.text, q.values)).rows);
      await cli.query('commit');
      return saida;
    } catch (e) {
      await cli.query('rollback').catch(() => {});
      throw e;
    } finally {
      cli.release();
    }
  };
  return sql;
}

// Faz require('@neondatabase/serverless') devolver o adaptador. Chame antes de carregar qualquer arquivo de api/.
function instalar(pool) {
  const sql = criarSql(pool);
  const original = Module._load;
  Module._load = function (req, ...resto) {
    return req === '@neondatabase/serverless' ? { neon: () => sql } : original.call(this, req, ...resto);
  };
  return sql;
}

module.exports = { criarSql, instalar };
