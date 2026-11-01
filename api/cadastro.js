const crypto = require('crypto');
const { db, rota, erro, hashSenha, criarSessao } = require('./_lib');
const V = require('./_validar');
const L = require('./_limite');

module.exports = rota('POST', async (req, res) => {
  const b = req.body || {}, sql = db();
  const nome = V.nomeUsuario(b.nome), email = V.email(b.email), senha = V.senha(b.senha);

  const lim = L.chaves(req).map(c => ({ ...c, limite: 10 })); // até 10 cadastros por dia por IP
  await L.verificar(sql, lim);
  await L.registrarFalha(sql, lim);

  const [{ n }] = await sql`select count(*)::int as n from usuarios`;
  if (n > 0 && String(process.env.CADASTRO_ABERTO || '').toLowerCase() === 'false') throw erro('Os cadastros estão fechados neste site.', 403);

  const u = { id: crypto.randomUUID(), versao: 1 }, hash = await hashSenha(senha);
  const q = [sql`insert into usuarios (id, email, nome, senha_hash) values (${u.id}, ${email}, ${nome}, ${hash}) on conflict (email) do nothing returning id`];
  // O primeiro usuário herda os dados da versão de uma só senha (linhas sem dono).
  if (n === 0) {
    q.push(sql`update titulos set user_id = ${u.id} where user_id is null`);
    q.push(sql`update tops set user_id = ${u.id} where user_id is null`);
  }
  const [criado] = await sql.transaction(q);
  if (!criado.length) throw erro('Este e-mail já está cadastrado. Entre com a sua senha.', 409);
  criarSessao(res, u);
  res.json({ ok: true, usuario: { id: u.id, nome, email } });
}, true);
