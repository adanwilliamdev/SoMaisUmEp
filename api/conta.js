const { db, rota, erro, confereSenha, hashSenha, criarSessao, encerrarSessao } = require('./_lib');
const V = require('./_validar');
const L = require('./_limite');

// Ações da conta (exigem estar logado e confirmar a senha atual): { acao: 'senha' | 'email' | 'excluir', senha, ... }
// Atenção: senha errada responde 403, nunca 401 (o 401 faria o app achar que a sessão caiu).
module.exports = rota('POST', async (req, res, u) => {
  const sql = db(),
    b = req.body || {};
  if (!['senha', 'email', 'excluir'].includes(b.acao)) throw erro('Ação inválida');

  const lim = L.chavesDe(req, 'cs', { ip: 60, alvo: u.id, limiteAlvo: 5 });
  await L.verificar(sql, lim);
  const [atual] = await sql`select senha_hash from usuarios where id = ${u.id}`;
  if (!atual || !(await confereSenha(String(b.senha || '').slice(0, 200), atual.senha_hash))) {
    await L.registrarFalha(sql, lim);
    throw erro('Senha atual incorreta.', 403);
  }
  await L.limpar(sql, lim);

  if (b.acao === 'senha') {
    const hash = await hashSenha(V.senha(b.nova));
    const [r] = await sql`update usuarios set senha_hash = ${hash}, versao = versao + 1 where id = ${u.id} returning versao`;
    criarSessao(res, { id: u.id, versao: r.versao }); // este aparelho continua logado; os outros caem
    return res.json({ ok: true });
  }

  if (b.acao === 'email') {
    const email = V.email(b.email);
    try {
      await sql`update usuarios set email = ${email} where id = ${u.id}`;
    } catch (e) {
      if ((e && (e.code || (e.sourceError && e.sourceError.code))) === '23505') throw erro('Este e-mail já está em uso por outra conta.', 409);
      throw e;
    }
    await sql`delete from reset_senha where user_id = ${u.id}`;
    return res.json({ ok: true, email });
  }

  // Excluir conta: apaga títulos, tops, capas e links (on delete cascade) e os arquivos do Blob.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const prefixo = '.public.blob.vercel-storage.com/capas/' + u.id + '/';
      const urls = [
        ...(await sql`select capa as url from titulos where user_id = ${u.id} and capa like 'https://%'`),
        ...(await sql`select url from capas where user_id = ${u.id}`),
      ]
        .map(r => r.url)
        .filter(x => x && x.includes(prefixo));
      for (let i = 0; i < urls.length; i += 100) await require('@vercel/blob').del(urls.slice(i, i + 100));
    } catch (e) {
      console.error('blob del (conta):', e.message);
    } // o que sobrar é órfão e a faxina diária remove
  }
  await sql`delete from usuarios where id = ${u.id}`;
  encerrarSessao(res);
  res.json({ ok: true });
});
