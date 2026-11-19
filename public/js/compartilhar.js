// Tops para compartilhar: imagem (canvas) e link público.
import { api } from './api.js';
import { L, achar, esperarSalvar } from './loja.js';
import { hue } from './util.js';

const W = 1080,
  H = 1350;
const COR = { fundo: '#f2ecdf', ponto: 'rgba(28,26,22,.16)', card: '#fffbf1', tinta: '#1c1a16', mut: '#5a5343', acc: '#c7321a', on: '#ffffff' };
const SERIFA = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';

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
  // Papel creme com grade de pontos, moldura de tinta e costura pontilhada: o mesmo "ingresso" do app.
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COR.ponto;
  for (let x = 24; x < W; x += 24) for (let y = 24; y < H; y += 24) ctx.fillRect(x, y, 2, 2);
  ctx.strokeStyle = COR.tinta;
  ctx.lineWidth = 6;
  rr(ctx, 20, 20, W - 40, H - 40, 28);
  ctx.stroke();
  ctx.setLineDash([10, 12]);
  ctx.lineWidth = 3;
  rr(ctx, 40, 40, W - 80, H - 80, 20);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textBaseline = 'alphabetic';
  const etiqueta = 'TOP ' + Math.max(top.itens.length, 1);
  ctx.font = `800 30px ${fonte}`;
  const ew = Math.ceil(ctx.measureText(etiqueta).width) + 40;
  ctx.fillStyle = COR.tinta;
  rr(ctx, 76, 88, ew, 52, 8);
  ctx.fill();
  ctx.fillStyle = COR.acc;
  rr(ctx, 72, 84, ew, 52, 8);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COR.tinta;
  ctx.stroke();
  ctx.fillStyle = COR.on;
  ctx.fillText(etiqueta, 92, 122);
  ctx.fillStyle = COR.tinta;
  ctx.font = `800 64px ${SERIFA}`;
  ctx.fillText(recorta(ctx, top.nome, W - 144), 72, 212);

  const itens = top.itens.slice(0, 10),
    y0 = 252,
    passo = Math.min(132, Math.floor(950 / Math.max(itens.length, 1)));
  itens.forEach((it, i) => {
    const y = y0 + i * passo,
      ph = passo - 16,
      pw = Math.round(((ph - 16) * 2) / 3);
    ctx.fillStyle = COR.tinta;
    rr(ctx, 64 + 6, y + 6, W - 128, ph, 14);
    ctx.fill();
    ctx.fillStyle = COR.card;
    rr(ctx, 64, y, W - 128, ph, 14);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = COR.tinta;
    ctx.stroke();
    ctx.fillStyle = i < 3 ? COR.acc : COR.mut;
    ctx.font = `800 ${Math.round(ph * 0.5)}px ${fonte}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 64 + 52, y + ph * 0.68);
    ctx.textAlign = 'left';
    const px = 64 + 104,
      im = imgs[i];
    ctx.save();
    rr(ctx, px, y + 8, pw, ph - 16, 6);
    ctx.clip();
    if (im) ctx.drawImage(im, px, y + 8, pw, ph - 16);
    else {
      ctx.fillStyle = `hsl(${hue(it.t)} 34% 30%)`;
      ctx.fillRect(px, y + 8, pw, ph - 16);
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.font = `800 ${Math.round(pw * 0.5)}px ${SERIFA}`;
      ctx.textAlign = 'center';
      ctx.fillText((it.t.trim()[0] || '?').toUpperCase(), px + pw / 2, y + ph / 2 + pw * 0.18);
      ctx.textAlign = 'left';
    }
    ctx.restore();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COR.tinta;
    rr(ctx, px, y + 8, pw, ph - 16, 6);
    ctx.stroke();
    ctx.fillStyle = COR.tinta;
    ctx.font = `700 ${Math.round(ph * 0.36)}px ${fonte}`;
    ctx.fillText(recorta(ctx, it.t, W - 128 - 104 - pw - 56), px + pw + 24, y + ph * 0.62);
  });

  ctx.fillStyle = COR.tinta;
  ctx.font = `800 36px ${SERIFA}`;
  ctx.fillText('SóMaisUmEp', 72, H - 72);
  ctx.fillStyle = COR.mut;
  ctx.font = `600 24px ${fonte}`;
  ctx.textAlign = 'right';
  ctx.fillText('só mais um ep', W - 72, H - 72);
  ctx.textAlign = 'left';
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
