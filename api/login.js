const { db, rota, erro, confereSenha, criarSessao } = require('./_lib');
const V = require('./_validar');
const L = require('./_limite');

const FALSO = 'scrypt$00000000000000000000000000000000$' + '0'.repeat(128); // para gastar o mesmo tempo quando o e-mail não existe

module.exports = rota('POST', async (req, res) => {
  const b = req.body || {}, sql = db();
  let email;
  try { email = V.email(b.email); } catch (e) { throw erro('E-mail ou senha incorretos', 401); }
  const lim = L.chaves(req, email);
  await L.verificar(sql, lim);

  const [u] = await sql`select id, nome, email, versao, senha_hash from usuarios where email = ${email}`;
  const ok = await confereSenha(String(b.senha || '').slice(0, 200), u ? u.senha_hash : FALSO);
  if (!u || !ok) {
    await L.registrarFalha(sql, lim);
    throw erro('E-mail ou senha incorretos', 401);
  }
  await L.limpar(sql, lim);
  criarSessao(res, u);
  res.json({ ok: true, usuario: { id: u.id, nome: u.nome, email: u.email } });
}, true);
