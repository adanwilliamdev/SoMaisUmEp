// Tops para compartilhar: imagem (canvas) e link público.
import { api } from './api.js';
import { L, achar, esperarSalvar } from './loja.js';
import { hue } from './util.js';

const W = 1080,
  H = 1350;
const COR = { fundo: '#121214', card: '#18181b', tx: '#f4f4f5', mut: '#a1a1aa', acc: '#9d7bf9' };

// Só imagens que a página pode usar (o CSP também barra o resto) e que dá para desenhar no canvas.
const capaOk = c =>
  typeof c === 'string' && (c.startsWith('data:image/') || /^https:\/\/(image\.tmdb\.org|[a-z0-9-]+\.public\.blob\.vercel-storage\.com)\//.test(c));

function carregarImg(url) {
  return new Promise(ok => {
    if (!capaOk(url)) return ok(null);
    const im = new Image(),
      t = setTimeout(() => ok(null), 8000);
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      clearTimeout(t);
      ok(im);
    };
    im.onerror = () => {
      clearTimeout(t);
      ok(null);
    };
    im.src = url;
  });
}

function recorta(ctx, texto, largura) {
  if (ctx.measureText(texto).width <= largura) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(t + '…').width > largura) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}
const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
};

// Desenha o top num canvas 1080x1350 (formato de feed). `imgs` = imagens já carregadas (ou null = letra colorida).
function desenhar(canvas, top, imgs) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d'),
    fonte = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W, 0, 0, W, 0, 900);
  g.addColorStop(0, 'rgba(255,92,108,.28)');
  g.addColorStop(1, 'rgba(255,92,108,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COR.acc;
  ctx.font = `800 30px ${fonte}`;
  ctx.fillText('TOP ' + Math.max(top.itens.length, 1), 72, 112);
  ctx.fillStyle = COR.tx;
  ctx.font = `800 60px ${fonte}`;
  ctx.fillText(recorta(ctx, top.nome, W - 144), 72, 186);

  const itens = top.itens.slice(0, 10),
    y0 = 236,
    passo = Math.min(140, Math.floor(1000 / Math.max(itens.length, 1)));
  itens.forEach((it, i) => {
    const y = y0 + i * passo,
      ph = passo - 12,
      pw = Math.round((ph * 2) / 3);
    ctx.fillStyle = COR.card;
    rr(ctx, 56, y, W - 112, ph, 18);
    ctx.fill();
    ctx.fillStyle = i < 3 ? COR.acc : COR.mut;
    ctx.font = `800 ${Math.round(ph * 0.52)}px ${fonte}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 56 + 56, y + ph * 0.68);
    ctx.textAlign = 'left';
    const px = 56 + 112,
      im = imgs[i];
    ctx.save();
    rr(ctx, px, y + 6, pw, ph - 12, 8);
    ctx.clip();
    if (im) ctx.drawImage(im, px, y + 6, pw, ph - 12);
    else {
      ctx.fillStyle = `hsl(${hue(it.t)} 40% 28%)`;
      ctx.fillRect(px, y + 6, pw, ph - 12);
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = `800 ${Math.round(pw * 0.5)}px ${fonte}`;
      ctx.textAlign = 'center';
      ctx.fillText((it.t.trim()[0] || '?').toUpperCase(), px + pw / 2, y + ph / 2 + pw * 0.18);
      ctx.textAlign = 'left';
    }
    ctx.restore();
    ctx.fillStyle = COR.tx;
    ctx.font = `700 ${Math.round(ph * 0.38)}px ${fonte}`;
    ctx.fillText(recorta(ctx, it.t, W - 112 - 112 - pw - 40), px + pw + 24, y + ph * 0.62);
  });

  ctx.fillStyle = COR.mut;
  ctx.font = `600 28px ${fonte}`;
  ctx.fillText('SóMaisUmEp', 72, H - 52);
}

// Gera a imagem do top. Se o navegador barrar as capas (CORS), refaz só com letras coloridas em vez de falhar.
export async function gerarImagem(canvas, top) {
  try {
    await document.fonts.ready;
  } catch (e) {
    /* segue com a fonte que tiver */
  }
  const imgs = await Promise.all(top.itens.slice(0, 10).map(it => carregarImg((it.sid && (achar(it.sid) || {}).capa) || null)));
  desenhar(canvas, top, imgs);
  try {
    canvas.toDataURL('image/png');
    return { semCapas: false };
  } catch (e) {
    desenhar(
      canvas,
      top,
      imgs.map(() => null),
    );
    return { semCapas: true };
  }
}

const paraBlob = canvas => new Promise((ok, no) => canvas.toBlob(b => (b ? ok(b) : no(new Error('Não foi possível gerar a imagem.'))), 'image/png'));
const nomeArquivo = nome =>
  'top-' +
  (String(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || '10') +
  '.png';

// Abre a folha de compartilhamento do aparelho (celular); sem ela, baixa o arquivo.
export async function enviarImagem(canvas, top) {
  const blob = await paraBlob(canvas),
    arq = new File([blob], nomeArquivo(top.nome), { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [arq] })) {
    try {
      await navigator.share({ files: [arq], title: top.nome });
      return 'compartilhado';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelado';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = arq.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'baixado';
}

/* ---------- link público ---------- */
export const urlPublica = codigo => `${location.origin}/t/${codigo}`;

export async function definirLink(top, ativo) {
  if (!(await esperarSalvar())) throw new Error('Ainda salvando suas alterações. Tente de novo em instantes.');
  const r = await api('/api/t', { method: 'POST', body: { id: top.id, ativo } });
  if (r.codigo) L.links[top.id] = r.codigo;
  else delete L.links[top.id];
  return r.codigo;
}

export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    return false;
  }
}
