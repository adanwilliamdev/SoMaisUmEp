const { db, rota } = require('./_lib');
const V = require('./_validar');
const { erro } = require('./_erro');

// Cotas por conta: protegem o banco contra contas que crescem sem limite. Só títulos/tops NOVOS contam:
// atualizar os que já existem continua funcionando mesmo com a conta cheia.
const MAX_TITULOS = 5000,
  MAX_TOPS = 200;

// Cada título/top carrega "base": a versão (campo `atualizado`) que o navegador conhecia.
// Vale também para exclusões (del: [{ id, base }]). Se outro aparelho gravou depois, a linha não é alterada nem apagada e o id volta em `conflitos`;
// o navegador então recarrega, mescla e reenvia.
module.exports = rota('POST', async (req, res, u) => {
  const sql = db(),
    b = req.body || {},
    d = b.del || {};
  const T = (Array.isArray(b.titulos) ? b.titulos : []).slice(0, 50).map(x => V.titulo(x, u.id));
  const P = (Array.isArray(b.tops) ? b.tops : []).slice(0, 50).map(V.top);
  const delT = V.exclusoes(d.titulos),
    delP = V.exclusoes(d.tops),
    agora = Date.now();
  const idsDelT = delT.map(x => x.id),
    idsDelP = delP.map(x => x.id);

  if (T.length) {
    const ids = [...new Set(T.map(t => t.id))];
    const [c] = await sql`select count(*)::int as n, count(*) filter (where id = any(${ids}))::int as ja from titulos where user_id = ${u.id}`;
    if (c && c.n + (ids.length - c.ja) > MAX_TITULOS) throw erro(`Limite de ${MAX_TITULOS} títulos por conta atingido. Exclua alguns para adicionar novos.`, 413);
  }
  if (P.length) {
    const ids = [...new Set(P.map(t => t.id))];
    const [c] = await sql`select count(*)::int as n, count(*) filter (where id = any(${ids}))::int as ja from tops where user_id = ${u.id}`;
    if (c && c.n + (ids.length - c.ja) > MAX_TOPS) throw erro(`Limite de ${MAX_TOPS} tops por conta atingido. Exclua alguns para criar novos.`, 413);
  }

  // Capas antigas no Blob (para apagar o arquivo se a capa mudar ou o título for excluído)
  const antigas = {};
  const idsCapa = [...new Set([...T.map(t => t.id), ...idsDelT])];
  if (idsCapa.length && process.env.BLOB_READ_WRITE_TOKEN) {
    for (const r of await sql`select id, capa from titulos where user_id = ${u.id} and id = any(${idsCapa}) and capa like 'https://%'`) antigas[r.id] = r.capa;
  }

  const q = [];
  for (const t of T)
    q.push(sql`
    insert into titulos (id, user_id, tipo, nome, capa, sinopse, ano, nota, duracao, tmdb, eps, vis, criado, nota_pessoal, resenha, visto_em, hist, proximo, atualizado)
    values (${t.id}, ${u.id}, ${t.tipo}, ${t.nome}, ${t.capa}, ${t.sinopse}, ${t.ano}, ${t.nota}, ${t.duracao}, ${t.tmdb}, ${t.eps}, ${t.vis}, ${t.criado},
            ${t.nota_pessoal}, ${t.resenha}, ${t.visto_em}, ${JSON.stringify(t.hist)}::jsonb, ${t.proximo ? JSON.stringify(t.proximo) : null}::jsonb, ${agora})
    on conflict (user_id, id) do update set tipo = excluded.tipo, nome = excluded.nome, capa = excluded.capa, sinopse = excluded.sinopse,
      ano = excluded.ano, nota = excluded.nota, duracao = excluded.duracao, tmdb = excluded.tmdb, eps = excluded.eps, vis = excluded.vis,
      nota_pessoal = excluded.nota_pessoal, resenha = excluded.resenha, visto_em = excluded.visto_em, hist = excluded.hist, proximo = excluded.proximo, atualizado = excluded.atualizado
    where titulos.user_id = ${u.id} and (titulos.atualizado = ${t.base}::bigint or ${t.base}::bigint is null)
    returning id, atualizado`);
  for (const t of P)
    q.push(sql`
    insert into tops (id, user_id, nome, itens, criado, atualizado)
    values (${t.id}, ${u.id}, ${t.nome}, ${JSON.stringify(t.itens)}::jsonb, ${t.criado}, ${agora})
    on conflict (user_id, id) do update set nome = excluded.nome, itens = excluded.itens, atualizado = excluded.atualizado
    where tops.user_id = ${u.id} and (tops.atualizado = ${t.base}::bigint or ${t.base}::bigint is null)
    returning id, atualizado`);
  // Exclusão com checagem de versão: só apaga se a linha ainda está na versão (base) que o navegador conhecia.
  // Sem base (formato antigo) apaga sempre. Cada item é comparado com a sua própria base (unnest em paralelo).
  const iDelT = q.length;
  if (delT.length)
    q.push(sql`
    delete from titulos t using unnest(${idsDelT}::text[], ${delT.map(x => x.base)}::bigint[]) as x(i, b)
    where t.user_id = ${u.id} and t.id = x.i and (x.b is null or t.atualizado = x.b) returning t.id`);
  const iDelP = q.length;
  if (delP.length)
    q.push(sql`
    delete from tops t using unnest(${idsDelP}::text[], ${delP.map(x => x.base)}::bigint[]) as x(i, b)
    where t.user_id = ${u.id} and t.id = x.i and (x.b is null or t.atualizado = x.b) returning t.id`);

  const out = q.length ? await sql.transaction(q) : []; // tudo ou nada
  const versoes = {},
    conflitos = [],
    aplicados = new Set();
  [...T, ...P].forEach((x, i) => {
    const r = out[i][0];
    if (r) {
      versoes[x.id] = Number(r.atualizado);
      aplicados.add(x.id);
    } else conflitos.push(x.id);
  });

  // Quem não foi apagado: se a linha ainda existe, foi alterada em outro aparelho (conflito: o navegador recarrega e a edição
  // do outro aparelho vence); se já não existe, alguém apagou antes e o resultado é o mesmo que o pedido.
  const apagadosT = new Set(delT.length ? out[iDelT].map(r => r.id) : []),
    apagadosP = new Set(delP.length ? out[iDelP].map(r => r.id) : []);
  const restamT = idsDelT.filter(id => !apagadosT.has(id)),
    restamP = idsDelP.filter(id => !apagadosP.has(id));
  if (restamT.length) for (const r of await sql`select id from titulos where user_id = ${u.id} and id = any(${restamT})`) conflitos.push(r.id);
  if (restamP.length) for (const r of await sql`select id from tops where user_id = ${u.id} and id = any(${restamP})`) conflitos.push(r.id);

  // Limpeza das capas do Blob (melhor esforço: falha aqui não desfaz o salvamento)
  const lixo = [];
  for (const [id, url] of Object.entries(antigas)) {
    const novo = T.find(t => t.id === id);
    if (apagadosT.has(id) || (novo && aplicados.has(id) && novo.capa !== url)) lixo.push(url);
  }
  if (lixo.length) {
    try {
      await require('@vercel/blob').del(lixo.filter(l => l.includes('.public.blob.vercel-storage.com/capas/' + u.id + '/')));
    } catch (e) {
      console.error('blob del', e.message);
    }
  }

  res.json({ ok: true, versoes, conflitos });
});
