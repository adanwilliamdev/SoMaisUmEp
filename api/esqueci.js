const { db, rota, erro } = require('./_lib');
const V = require('./_validar');
const L = require('./_limite');
const T = require('./_token');
const E = require('./_email');

// Pede o link de redefinição de senha. A resposta é SEMPRE a mesma (exista o e-mail ou não),
// para não revelar quem tem conta por aqui.
module.exports = rota('POST', async (req, res) => {
  const sql = db(), email = V.email((req.body || {}).email);
  if (!E.configurado()) throw erro('A recuperação de senha não está configurada neste site.', 501);

  const lim = L.chavesDe(req, 'rs', { ip: 10, alvo: email, limiteAlvo: 3 });   // 3 pedidos por e-mail, 10 por IP
  await L.verificar(sql, lim);
  await L.registrarFalha(sql, lim);                                             // todo pedido conta

  const [u] = await sql`select id, nome from usuarios where email = ${email}`;
  if (u) {
    const t = T.novo(), agora = Date.now();
    await sql.transaction([
      sql`delete from reset_senha where user_id = ${u.id}`,
      sql`insert into reset_senha (token_hash, user_id, expira, criado) values (${t.hash}, ${u.id}, ${t.expira}, ${agora})`,
    ]);
    try { await E.enviar({ para: email, ...E.emailRedefinir(u.nome, t.token) }); }
    catch (e) { console.error('e-mail de redefinição:', e.message); }           // não conta ao usuário (evita revelar o e-mail)
  }
  res.json({ ok: true });
}, true);
