// Compartilhar um top: imagem 1080×1350 e link público.
import { $, aviso, confirma } from '../util.js';
import { L } from '../loja.js';
import * as V from '../views.js';
import { gerarImagem, enviarImagem, definirLink, urlPublica, copiar } from '../compartilhar.js';
import { dlg, ctx, gancho, aba } from './ctx.js';

let compart = null; // { top, canvas, pronto, semCapas }

function pintaCompartilhar() {
  const t = compart.top,
    codigo = L.links[t.id];
  dlg.innerHTML = V.htmlCompartilhar(t, codigo, codigo ? urlPublica(codigo) : '');
  if (!compart.pronto) return;
  const prev = $('#share-prev');
  prev.removeAttribute('aria-busy');
  prev.replaceChildren(compart.canvas);
  compart.canvas.setAttribute('role', 'img');
  compart.canvas.setAttribute('aria-label', `Imagem do top ${t.nome}`);
  dlg.querySelector('[data-act="img-enviar"]').disabled = false;
  if (compart.semCapas) $('#share-msg').textContent = 'Não foi possível carregar as capas para a imagem; ela usa letras no lugar.';
}

async function abrirCompartilhar(t) {
  ctx.aberta = null;
  const c = (compart = { top: t, canvas: document.createElement('canvas'), pronto: false, semCapas: false });
  pintaCompartilhar();
  if (!dlg.open) dlg.showModal();
  const r = await gerarImagem(c.canvas, t);
  if (compart !== c) return; // fechou ou abriu outro
  c.pronto = true;
  c.semCapas = r.semCapas;
  if (dlg.open && $('#share-prev')) pintaCompartilhar();
}

async function mudarLink(t, ativo, b) {
  if (b) b.disabled = true;
  try {
    await definirLink(t, ativo);
    pintaCompartilhar();
    if (ativo) aviso('Link criado.');
  } catch (e) {
    const m = $('#share-msg');
    if (m) m.textContent = e.rede ? 'Sem conexão.' : e.message;
    if (b && b.isConnected) b.disabled = false;
  }
}

dlg.addEventListener('close', () => {
  compart = null;
  if (aba() === '#tops') gancho.render();
});

export const acoes = {
  compartilhar: ({ t }) => {
    if (t) abrirCompartilhar(t);
  },
  'img-enviar': async ({ b }) => {
    if (!compart) return;
    b.disabled = true;
    try {
      const r = await enviarImagem(compart.canvas, compart.top);
      if (r === 'baixado') aviso('Imagem baixada.');
    } catch (err) {
      aviso(err.message);
    }
    b.disabled = false;
  },
  'link-criar': async ({ b, t }) => {
    if (t) await mudarLink(t, true, b);
  },
  'link-desligar': ({ b, t }) => {
    if (t) confirma(b, () => mudarLink(t, false, b));
  },
  'link-copiar': async ({ t }) => {
    if (!t) return;
    const ok = await copiar(urlPublica(L.links[t.id]));
    if (!ok) $('#share-url').select();
    aviso(ok ? 'Link copiado.' : 'Selecione o link e copie.');
  },
};
