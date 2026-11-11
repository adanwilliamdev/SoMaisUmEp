// Envio de e-mail transacional pelo Resend (https://resend.com). Sem as variáveis, a recuperação de senha fica desligada.
const { erro } = require('./_erro');
const { esc } = require('./_texto');

// Endereço público do site, usado nos links. Nunca vem do cabeçalho Host (poderia ser forjado).
const baseUrl = () =>
  String(process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : ''))
    .trim()
    .replace(/\/+$/, '');
const configurado = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && baseUrl());

async function enviar({ para, assunto, html, texto }) {
  let r;
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [para], subject: assunto, html, text: texto }),
    });
  } catch (e) {
    throw new Error('Resend: sem resposta');
  }
  if (!r.ok) throw new Error('Resend: HTTP ' + r.status);
}

function emailRedefinir(nome, token) {
  const link = `${baseUrl()}/#redefinir=${token}`;
  return {
    assunto: 'SóMaisUmEp: redefinir sua senha',
    texto: `Olá, ${nome}!\n\nPara criar uma nova senha, abra o link (vale por 1 hora e só funciona uma vez):\n${link}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.`,
    html: `<p>Olá, ${esc(nome)}!</p><p>Para criar uma nova senha, <a href="${esc(link)}">clique aqui</a>. O link vale por 1 hora e só funciona uma vez.</p><p style="color:#666">Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`,
    link,
  };
}

module.exports = { configurado, enviar, emailRedefinir, erro };
