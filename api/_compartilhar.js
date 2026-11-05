const crypto = require('crypto');
const { db, rota, erro } = require('./_lib');
const V = require('./_validar');

// Liga/desliga o link público de um top: { id, ativo }. O código da URL (/t/<código>) é aleatório e some quando o link é desligado.
module.exports = rota('POST', async (req, res, u) => {
  const b = req.body || {}, id = String(b.id || ''), sql = db();
  if (!V.ID.test(id)) throw erro('Top inválido');
  const [t] = await sql`select publico, jsonb_array_length(itens)::int as n from tops where id = ${id} and user_id = ${u.id}`;
  if (!t) throw erro('Top não encontrado. Espere o salvamento terminar e tente de novo.', 404);

  if (!b.ativo) {
    await sql`update tops set publico = null, publico_em = null where id = ${id} and user_id = ${u.id}`;
    return res.json({ ok: true, codigo: null });
  }
  if (!t.n) throw erro('Adicione ao menos um título ao top antes de compartilhar.');
  if (t.publico) return res.json({ ok: true, codigo: t.publico });
  const codigo = crypto.randomBytes(9).toString('base64url'); // 12 caracteres
  await sql`update tops set publico = ${codigo}, publico_em = ${Date.now()} where id = ${id} and user_id = ${u.id}`;
  res.json({ ok: true, codigo });
});
