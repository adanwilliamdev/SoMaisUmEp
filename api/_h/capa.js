const { db, rota, erro } = require('../_lib');

// Cotas por usuário (o Blob é pago por armazenamento e os envios são feitos pelo navegador).
const POR_HORA = 30,
  TOTAL = 1000;

// Recebe a capa já reduzida (JPEG em base64) e guarda no Vercel Blob; devolve só o link.
module.exports = rota('POST', async (req, res, u) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw erro('Armazenamento de capas não configurado no servidor.', 501);
  const img = String((req.body || {}).imagem || '');
  if (img.length > 120000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(img)) throw erro('Imagem inválida');

  const sql = db();
  const [c] = await sql`select count(*) filter (where criado > ${Date.now() - 36e5})::int as hora, count(*)::int as total from capas where user_id = ${u.id}`;
  if (c.hora >= POR_HORA) throw erro('Muitos envios de capa em pouco tempo. Tente de novo mais tarde.', 429);
  if (c.total >= TOTAL) throw erro('Limite de capas armazenadas atingido. Remova títulos que não usa mais.', 429);

  const { put } = require('@vercel/blob');
  const arq = await put(`capas/${u.id}/capa.jpg`, Buffer.from(img.split(',')[1], 'base64'), {
    access: 'public',
    contentType: 'image/jpeg',
    addRandomSuffix: true,
    cacheControlMaxAge: 31536000,
  });
  // Registro para a cota e para a limpeza de órfãs (api/cron.js apaga o que não estiver em nenhum título).
  await sql`insert into capas (url, user_id, criado) values (${arq.url}, ${u.id}, ${Date.now()}) on conflict (url) do nothing`;
  res.json({ url: arq.url });
});
