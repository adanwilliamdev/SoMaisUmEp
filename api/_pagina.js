const { db } = require('./_lib');
const { esc, hue } = require('./_texto');

// Página pública de um top (GET /t/<código>, veja "rewrites" no vercel.json): HTML pronto no servidor,
// para a prévia do link (Open Graph) aparecer em redes e mensageiros, que não rodam JavaScript.
const CODIGO = /^[\w-]{8,32}$/;
const urlOk = c => (typeof c === 'string' && /^https:\/\/[\w./:+=%?&,~@-]+$/.test(c) && c.length < 600 ? c : null);

const pagina = ({ titulo, descricao, imagem, corpo, status = 200 }) => ({
  status,
  html: `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title><meta name="description" content="${esc(descricao)}"><meta name="robots" content="noindex">
<meta property="og:type" content="website"><meta property="og:site_name" content="SóMaisUmEp"><meta property="og:title" content="${esc(titulo)}"><meta property="og:description" content="${esc(descricao)}">
${imagem ? `<meta property="og:image" content="${esc(imagem)}"><meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<meta name="theme-color" content="#14110f"><link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=DM+Sans:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/style.css"><script src="/tema.js"></script><script type="module" src="/js/publico.js"></script></head>
<body class="publico"><main class="pub">${corpo}</main></body></html>`,
});

function render(t, caps) {
  const itens = (Array.isArray(t.itens) ? t.itens : []).slice(0, 10).filter(i => i && i.t);
  const porId = new Map(caps.map(c => [c.id, c]));
  const autor =
    String(t.autor || '')
      .trim()
      .split(/\s+/)[0] || '';
  const li = itens
    .map((it, i) => {
      const capa = urlOk((porId.get(it.sid) || {}).capa);
      return `<li><span class="n">${i + 1}</span><div class="p">${capa ? `<img src="${esc(capa)}" alt="" loading="lazy">` : `<div class="ph" data-h="${hue(it.t)}"><span>${esc((it.t.trim()[0] || '?').toUpperCase())}</span></div>`}</div><span class="t">${esc(it.t)}</span></li>`;
    })
    .join('');
  const resumo = itens
    .slice(0, 3)
    .map((it, i) => `${i + 1}. ${it.t}`)
    .join(' · ');
  const img = itens.map(it => urlOk((porId.get(it.sid) || {}).capa)).find(Boolean) || null;
  return pagina({
    titulo: `${t.nome}${autor ? ' · por ' + autor : ''} · SóMaisUmEp`,
    descricao: resumo ? `${resumo}${itens.length > 3 ? '…' : ''}` : 'Um top 10 de séries e filmes.',
    imagem: img,
    corpo: `<section class="top"><div class="top-cab"><h1>${esc(t.nome)}</h1><small>${itens.length}/10</small></div>
      ${autor ? `<p class="sub">por ${esc(autor)}</p>` : ''}<ol>${li}</ol></section>
      <p class="pub-cta">Marque cada episódio e saiba sempre qual é o próximo. <a class="btn" href="/">Conheça o SóMaisUmEp</a></p>`,
  });
}

module.exports = async (req, res) => {
  const enviar = ({ status, html }, cache) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', cache);
    res.status(status).send(html);
  };
  const naoAchou = () =>
    enviar(
      pagina({
        status: 404,
        titulo: 'Top não encontrado · SóMaisUmEp',
        descricao: 'Este link não existe ou deixou de ser compartilhado.',
        corpo:
          '<section class="top"><div class="top-cab"><h1>Top não encontrado</h1></div><p class="sub">Este link não existe ou deixou de ser compartilhado.</p></section><p class="pub-cta"><a class="btn" href="/">Ir para o SóMaisUmEp</a></p>',
      }),
      'no-store',
    );
  try {
    const codigo = String((req.query || {}).c || '');
    if (!CODIGO.test(codigo)) return naoAchou();
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL ausente');
    const sql = db();
    const [t] = await sql`select t.nome, t.itens, t.user_id, u.nome as autor from tops t join usuarios u on u.id = t.user_id where t.publico = ${codigo}`;
    if (!t) return naoAchou();
    const sids = (Array.isArray(t.itens) ? t.itens : [])
      .map(i => i && i.sid)
      .filter(Boolean)
      .slice(0, 10);
    const caps = sids.length ? await sql`select id, capa from titulos where user_id = ${t.user_id} and id = any(${sids})` : [];
    enviar(render(t, caps), 'public, max-age=0, s-maxage=30');
  } catch (e) {
    console.error(e);
    enviar(
      pagina({
        status: 500,
        titulo: 'Erro · SóMaisUmEp',
        descricao: 'Não foi possível abrir este top agora.',
        corpo:
          '<section class="top"><div class="top-cab"><h1>Algo deu errado</h1></div><p class="sub">Não foi possível abrir este top agora. Tente de novo em instantes.</p></section>',
      }),
      'no-store',
    );
  }
};
