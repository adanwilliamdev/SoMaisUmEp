const crypto = require('crypto');
const { db, rota, erro, hashSenha, criarSessao } = require('../_lib');
const V = require('../_validar');
const L = require('../_limite');

module.exports = rota(
  'POST',
  async (req, res) => {
    const b = req.body || {},
      sql = db();
    const nome = V.nomeUsuario(b.nome),
      email = V.email(b.email),
      senha = V.senha(b.senha);

    // Até 30 cadastros por dia (UTC) por IP, em janela fixa e com contador próprio (não mistura com as falhas de login do mesmo IP).
    // Passou disso, fica bloqueado até a virada do dia. O limite é folgado por causa de IPs compartilhados (CGNAT).
    const lim = [L.janela('cad-ip', L.ipDe(req), 30, 864e5)];
    await L.verificar(sql, lim);
    await L.registrarFalha(sql, lim);

    const [{ n }] = await sql`select count(*)::int as n from usuarios`;
    if (n > 0 && String(process.env.CADASTRO_ABERTO || '').toLowerCase() === 'false') throw erro('Os cadastros estão fechados neste site.', 403);

    const u = { id: crypto.randomUUID(), versao: 1 },
      hash = await hashSenha(senha);
    const q = [
      sql`insert into usuarios (id, email, nome, senha_hash) values (${u.id}, ${email}, ${nome}, ${hash}) on conflict (email) do nothing returning id`,
    ];
    // Dados da versão de uma só senha (linhas sem dono) só são adotados se o dono do site pedir de propósito
    // (ADOTAR_DADOS_ANTIGOS=true) e apenas pela primeira conta. Sem isso, quem se cadastrar primeiro num banco
    // com dados antigos não leva nada.
    if (n === 0 && String(process.env.ADOTAR_DADOS_ANTIGOS || '').toLowerCase() === 'true') {
      q.push(sql`update titulos set user_id = ${u.id} where user_id is null`);
      q.push(sql`update tops set user_id = ${u.id} where user_id is null`);
    }
    const [criado] = await sql.transaction(q);
    // Decisão consciente: avisar que o e-mail já existe revela quem tem conta (enumeração de usuários). Num app pessoal,
    // a clareza para quem tenta se cadastrar de novo vale mais; o login e a recuperação de senha, esses sim, não revelam nada.
    if (!criado.length) throw erro('Este e-mail já está cadastrado. Entre com a sua senha.', 409);
    criarSessao(res, u);
    res.json({ ok: true, usuario: { id: u.id, nome, email } });
  },
  true,
);
