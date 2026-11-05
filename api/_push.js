// Notificações push: estado (GET), assinar / cancelar / teste (POST). Montado dentro de api/dados.js (?r=push) para não
// gastar mais uma função no limite do plano Hobby da Vercel.
const { db, rota, erro } = require('./_lib');
const V = require('./_validar');
const L = require('./_limite');
const W = require('./_webpush');

const MAX_APARELHOS = 10; // por conta; passando disso, os mais antigos saem

// GET: a chave pública que o navegador precisa para assinar (null = servidor sem avisos configurados) e quantos aparelhos a conta tem.
const estado = rota('GET', async (req, res, u) => {
  const [r] = await db()`select count(*)::int as n from push_assinaturas where user_id = ${u.id}`;
  res.json({ chave: process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT ? process.env.VAPID_PUBLIC_KEY : null, aparelhos: r.n });
});

// POST { acao: 'assinar', assinatura } | { acao: 'cancelar', endpoint } | { acao: 'teste', endpoint }
const comando = rota('POST', async (req, res, u) => {
  const sql = db(),
    b = req.body || {};
  if (!['assinar', 'cancelar', 'teste'].includes(b.acao)) throw erro('Ação inválida');

  if (b.acao === 'assinar') {
    const a = V.assinaturaPush(b.assinatura);
    await sql`
      insert into push_assinaturas (endpoint, user_id, p256dh, auth) values (${a.endpoint}, ${u.id}, ${a.p256dh}, ${a.auth})
      on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth,
        ultimo_dia = case when push_assinaturas.user_id = excluded.user_id then push_assinaturas.ultimo_dia else null end,
        user_id = excluded.user_id`;
    await sql`
      delete from push_assinaturas where user_id = ${u.id}
        and endpoint not in (select endpoint from push_assinaturas where user_id = ${u.id} order by criado desc limit ${MAX_APARELHOS})`;
    return res.json({ ok: true });
  }

  const endpoint = W.endpointOk(b.endpoint);
  if (!endpoint) throw erro('Endereço inválido');

  if (b.acao === 'cancelar') {
    await sql`delete from push_assinaturas where endpoint = ${endpoint} and user_id = ${u.id}`;
    return res.json({ ok: true });
  }

  // teste: um aviso de verdade para este aparelho, para a pessoa ver que funciona (no máximo 5 por 15 min)
  const vapid = W.chaves();
  if (!vapid) throw erro('Os avisos ainda não foram configurados neste servidor.', 503);
  const lim = L.chavesDe(req, 'pt', { ip: 30, alvo: u.id, limiteAlvo: 5 });
  await L.verificar(sql, lim);
  await L.registrarFalha(sql, lim); // conta cada teste; passou de 5, bloqueia
  const [s] = await sql`select endpoint, p256dh, auth from push_assinaturas where endpoint = ${endpoint} and user_id = ${u.id}`;
  if (!s) throw erro('Este aparelho não está inscrito. Ative os avisos de novo.', 404);
  let r;
  try {
    r = await W.enviar(s, { titulo: 'SóMaisUmEp', corpo: 'Está funcionando: os avisos de episódios novos chegam neste aparelho.', url: '/', tag: 'teste' }, vapid);
  } catch (e) {
    console.error('push teste:', e.message);
    throw erro('Não foi possível falar com o serviço de notificações agora.', 502);
  }
  if (r.gone) {
    await sql`delete from push_assinaturas where endpoint = ${endpoint}`;
    throw erro('A inscrição deste aparelho expirou. Ative os avisos de novo.', 410);
  }
  if (!r.ok) throw erro(`O serviço de notificações recusou o aviso (código ${r.status}).`, 502);
  res.json({ ok: true });
});

module.exports = { estado, comando, MAX_APARELHOS };
