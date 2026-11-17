const { db, rota, erro, hashSenha } = require('../_lib');
const V = require('../_validar');
const L = require('../_limite');
const T = require('../_token');

// Troca a senha com o token recebido por e-mail. O token é consumido na mesma instrução que altera a senha
// (um único comando SQL: ou tudo, ou nada) e todas as sessões abertas são encerradas (versao + 1).
module.exports = rota(
  'POST',
  async (req, res) => {
    const sql = db(),
      b = req.body || {},
      senha = V.senha(b.senha);
    const lim = L.chavesDe(req, 'rd', { ip: 60 });
    await L.verificar(sql, lim);
    if (!T.valido(b.token)) {
      await L.registrarFalha(sql, lim);
      throw erro('Link inválido ou expirado. Peça um novo.');
    }

    const hash = await hashSenha(senha);
    const [u] = await sql`
    with t as (delete from reset_senha where token_hash = ${T.hashToken(b.token)} and expira > ${Date.now()} returning user_id)
    update usuarios set senha_hash = ${hash}, versao = versao + 1 where id in (select user_id from t) returning id, email`;
    if (!u) {
      await L.registrarFalha(sql, lim);
      throw erro('Link inválido ou expirado. Peça um novo.');
    }

    await sql`delete from reset_senha where user_id = ${u.id}`; // outros links pendentes deixam de valer
    await sql`delete from tentativas where chave = ${'em:' + L.hash(u.email)}`; // quem esqueceu a senha pode ter errado várias vezes
    res.json({ ok: true });
  },
  true,
);
