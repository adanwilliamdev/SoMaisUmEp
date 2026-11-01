const { rota, erro } = require('./_lib');

// Recebe a capa já reduzida (JPEG em base64) e guarda no Vercel Blob; devolve só o link.
module.exports = rota('POST', async (req, res, u) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw erro('Armazenamento de capas não configurado no servidor.', 501);
  const img = String((req.body || {}).imagem || '');
  if (img.length > 120000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(img)) throw erro('Imagem inválida');
  const { put } = require('@vercel/blob');
  const arq = await put(`capas/${u.id}/capa.jpg`, Buffer.from(img.split(',')[1], 'base64'), {
    access: 'public', contentType: 'image/jpeg', addRandomSuffix: true, cacheControlMaxAge: 31536000,
  });
  res.json({ url: arq.url });
});
