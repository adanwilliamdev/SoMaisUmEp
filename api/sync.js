const { db, rota, erro } = require('./_lib');

const ID = /^[\w-]{1,64}$/;
const txt = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '') || null;
const inteiros = (a, max) => (Array.isArray(a) ? a.slice(0, 60) : []).map(n => Math.max(0, Math.min(max, parseInt(n, 10) || 0)));
const capaOk = c => (typeof c === 'string' && c.length <= 120000 && (/^https:\/\/image\.tmdb\.org\//.test(c) || /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(c)) ? c : null);
const num = (v, min, max, casas = 0) => (v == null || v === '' || !Number.isFinite(+v) ? null : Math.round(Math.min(max, Math.max(min, +v)) * 10 ** casas) / 10 ** casas);

function titulo(x) {
  if (!x || !ID.test(x.id || '')) throw erro('Título inválido');
  const tipo = x.tipo === 'movie' ? 'movie' : 'tv';
  const eps = tipo === 'movie' ? [1] : inteiros(x.eps, 999).map(n => Math.max(1, n));
  if (!eps.length) throw erro('Série sem temporadas');
  const v = inteiros(x.vis, 999);
  return {
    id: x.id, tipo, nome: txt(x.nome, 80) || 'Sem nome', capa: capaOk(x.capa),
    sinopse: txt(x.sinopse, 2000), ano: txt(x.ano, 10), nota: num(x.nota, 0, 10, 1),
    duracao: num(x.duracao, 0, 1000), tmdb: num(x.tmdb, 0, 1e9),
    eps, vis: eps.map((n, i) => Math.min(v[i] || 0, n)),
    criado: num(x.criado, 0, 8.64e15) ?? Date.now(),
  };
}

function top(x) {
  if (!x || !ID.test(x.id || '')) throw erro('Top inválido');
  const itens = (Array.isArray(x.itens) ? x.itens : []).slice(0, 10)
    .map(i => ({ t: txt(i && i.t, 80), sid: i && ID.test(i.sid || '') ? i.sid : undefined })).filter(i => i.t);
  return { id: x.id, nome: txt(x.nome, 60) || 'Top 10', itens, criado: num(x.criado, 0, 8.64e15) ?? Date.now() };
}

const ids = a => (Array.isArray(a) ? a : []).filter(i => typeof i === 'string' && ID.test(i)).slice(0, 200);

module.exports = rota('POST', async (req, res) => {
  const b = req.body || {}, d = b.del || {};
  const T = (b.titulos || []).slice(0, 50).map(titulo), P = (b.tops || []).slice(0, 50).map(top);
  const ops = [];
  if (T.length) ops.push(db().from('titulos').upsert(T, { onConflict: 'id' }));
  if (P.length) ops.push(db().from('tops').upsert(P, { onConflict: 'id' }));
  if (ids(d.titulos).length) ops.push(db().from('titulos').delete().in('id', ids(d.titulos)));
  if (ids(d.tops).length) ops.push(db().from('tops').delete().in('id', ids(d.tops)));
  for (const r of await Promise.all(ops)) if (r.error) throw r.error;
  res.json({ ok: true });
});
