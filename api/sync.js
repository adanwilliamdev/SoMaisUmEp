const { db, rota } = require('./_lib');
const V = require('./_validar');

// Cada título/top carrega "base": a versão (campo `atualizado`) que o navegador conhecia.
// Se outro aparelho gravou depois, a linha não é alterada e o id volta em `conflitos`;
// o navegador então recarrega, mescla e reenvia.
module.exports = rota('POST', async (req, res, u) => {
  const sql = db(), b = req.body || {}, d = b.del || {};
  const T = (Array.isArray(b.titulos) ? b.titulos : []).slice(0, 50).map(x => V.titulo(x, u.id));
  const P = (Array.isArray(b.tops) ? b.tops : []).slice(0, 50).map(V.top);
  const delT = V.ids(d.titulos), delP = V.ids(d.tops), agora = Date.now();

  // Capas antigas no Blob (para apagar o arquivo se a capa mudar ou o título for excluído)
  let antigas = {};
  const idsCapa = [...new Set([...T.map(t => t.id), ...delT])];
  if (idsCapa.length && process.env.BLOB_READ_WRITE_TOKEN) {
    for (const r of await sql`select id, capa from titulos where user_id = ${u.id} and id = any(${idsCapa}) and capa like 'https://%'`) antigas[r.id] = r.capa;
  }

  const q = [];
  for (const t of T) q.push(sql`
    insert into titulos (id, user_id, tipo, nome, capa, sinopse, ano, nota, duracao, tmdb, eps, vis, criado, nota_pessoal, resenha, visto_em, hist, atualizado)
    values (${t.id}, ${u.id}, ${t.tipo}, ${t.nome}, ${t.capa}, ${t.sinopse}, ${t.ano}, ${t.nota}, ${t.duracao}, ${t.tmdb}, ${t.eps}, ${t.vis}, ${t.criado},
            ${t.nota_pessoal}, ${t.resenha}, ${t.visto_em}, ${JSON.stringify(t.hist)}::jsonb, ${agora})
    on conflict (id) do update set tipo = excluded.tipo, nome = excluded.nome, capa = excluded.capa, sinopse = excluded.sinopse,
      ano = excluded.ano, nota = excluded.nota, duracao = excluded.duracao, tmdb = excluded.tmdb, eps = excluded.eps, vis = excluded.vis,
      nota_pessoal = excluded.nota_pessoal, resenha = excluded.resenha, visto_em = excluded.visto_em, hist = excluded.hist, atualizado = excluded.atualizado
    where titulos.user_id = ${u.id} and (titulos.atualizado = ${t.base}::bigint or ${t.base}::bigint is null)
    returning id, atualizado`);
  for (const t of P) q.push(sql`
    insert into tops (id, user_id, nome, itens, criado, atualizado)
    values (${t.id}, ${u.id}, ${t.nome}, ${JSON.stringify(t.itens)}::jsonb, ${t.criado}, ${agora})
    on conflict (id) do update set nome = excluded.nome, itens = excluded.itens, atualizado = excluded.atualizado
    where tops.user_id = ${u.id} and (tops.atualizado = ${t.base}::bigint or ${t.base}::bigint is null)
    returning id, atualizado`);
  if (delT.length) q.push(sql`delete from titulos where user_id = ${u.id} and id = any(${delT})`);
  if (delP.length) q.push(sql`delete from tops where user_id = ${u.id} and id = any(${delP})`);

  const out = q.length ? await sql.transaction(q) : []; // tudo ou nada
  const versoes = {}, conflitos = [], aplicados = new Set();
  [...T, ...P].forEach((x, i) => { const r = out[i][0]; if (r) { versoes[x.id] = Number(r.atualizado); aplicados.add(x.id); } else conflitos.push(x.id); });

  // Limpeza das capas do Blob (melhor esforço: falha aqui não desfaz o salvamento)
  const lixo = [];
  for (const [id, url] of Object.entries(antigas)) {
    const novo = T.find(t => t.id === id);
    if (delT.includes(id) || (novo && aplicados.has(id) && novo.capa !== url)) lixo.push(url);
  }
  if (lixo.length) { try { await require('@vercel/blob').del(lixo.filter(l => l.includes('.public.blob.vercel-storage.com/capas/' + u.id + '/'))); } catch (e) { console.error('blob del', e.message); } }

  res.json({ ok: true, versoes, conflitos });
});
