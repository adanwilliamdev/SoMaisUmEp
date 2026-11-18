const { db, rota, erro, confereSenha, precisaRehash, hashSenha, HASH_FALSO, criarSessao } = require('../_lib');
const V = require('../_validar');
const L = require('../_limite');

module.exports = rota(
  'POST',
  async (req, res) => {
    const b = req.body || {},
      sql = db();
    let email;
    try {
      email = V.email(b.email);
    } catch (e) {
      throw erro('E-mail ou senha incorretos', 401);
    }
    const lim = L.chaves(req, email);
    await L.verificar(sql, lim);

    const [u] = await sql`select id, nome, email, versao, senha_hash from usuarios where email = ${email}`;
    const senha = String(b.senha || '').slice(0, 200);
    const ok = await confereSenha(senha, u ? u.senha_hash : HASH_FALSO); // sem conta: gasta o mesmo tempo com um hash de mentira
    if (!u || !ok) {
      await L.registrarFalha(sql, lim);
      throw erro('E-mail ou senha incorretos', 401);
    }
    await L.limpar(sql, lim);
    // Hash com custo antigo (ou formato legado): regrava com os parâmetros atuais agora que a senha está em mãos.
    // Melhor esforço e sem mexer na `versao` (as outras sessões continuam valendo); só grava se o hash não mudou nesse meio-tempo.
    if (precisaRehash(u.senha_hash)) {
      try {
        await sql`update usuarios set senha_hash = ${await hashSenha(senha)} where id = ${u.id} and senha_hash = ${u.senha_hash}`;
      } catch (e) {
        console.error('rehash de senha:', e.message);
      }
    }
    criarSessao(res, u);
    res.json({ ok: true, usuario: { id: u.id, nome: u.nome, email: u.email } });
  },
  true,
);
