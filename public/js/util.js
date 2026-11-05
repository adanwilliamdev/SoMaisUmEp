export const $ = s => document.querySelector(s);
export const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => crypto.randomUUID();
export const hue = n => [...String(n)].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) % 360;

// Texto de status no rodapé
export function status(t, erro) { const el = $('#status'); if (el) { el.textContent = t; el.style.color = erro ? 'var(--perigo)' : ''; } }

// Mensagem rápida (some sozinha)
export function aviso(texto, ms = 4200) {
  const caixa = $('#avisos'); if (!caixa) return;
  const el = document.createElement('div');
  el.className = 'aviso-flutuante'; el.textContent = texto;
  caixa.append(el);
  setTimeout(() => { el.classList.add('sai'); setTimeout(() => el.remove(), 300); }, ms);
}

// Faixa fixa no topo (ex.: sem conexão)
export function faixa(texto) {
  const el = $('#faixa'); if (!el) return;
  el.hidden = !texto; el.textContent = texto || '';
}

export const guardar = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) { /* armazenamento cheio ou bloqueado */ } };
export const ler = (k, padrao = null) => { try { const v = localStorage.getItem(k); return v == null ? padrao : v; } catch (e) { return padrao; } };
export const lerJSON = (k, padrao = null) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch (e) { return padrao; } };
export const apagar = k => { try { localStorage.removeItem(k); } catch (e) { /* ignora */ } };

// Estilos que dependem de dados (cor, atraso, largura, capa). Como o CSP não aceita style="" no HTML,
// o HTML traz data-h / data-i / data-w / data-cover e estes viram propriedades CSS logo após a inserção.
const ESTILOS = '[data-h],[data-i],[data-w],[data-cover]';
export function aplicarEstilos(raiz = document) {
  const lista = raiz.matches && raiz.matches(ESTILOS) ? [raiz] : [];
  lista.push(...raiz.querySelectorAll(ESTILOS));
  for (const el of lista) {
    const d = el.dataset;
    if (d.h != null) el.style.setProperty('--h', d.h);
    if (d.i != null) el.style.setProperty('--i', d.i);
    if (d.w != null) el.style.width = d.w + '%';
    if (d.cover != null) el.style.setProperty('--cover', `url("${d.cover.replace(/["\\\n]/g, '')}")`);
  }
}
export function observarEstilos() {
  aplicarEstilos();
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) aplicarEstilos(n); })
    .observe(document.body, { childList: true, subtree: true });
}

// Aviso com botão "Desfazer". Só um por vez: um novo substitui o anterior (desfazer vale para a ação mais recente).
let desfazerAtual = null;
export function avisoDesfazer(texto, fn, ms = 7000) {
  const caixa = $('#avisos'); if (!caixa) return;
  if (desfazerAtual) desfazerAtual.fecha();
  const el = document.createElement('div'), t = document.createElement('span'), b = document.createElement('button');
  el.className = 'aviso-flutuante com-acao'; t.textContent = texto;
  b.type = 'button'; b.className = 'aviso-acao'; b.textContent = 'Desfazer';
  el.append(t, b); caixa.append(el);
  let feito = false, timer;
  const h = {
    fecha() { if (feito) return; feito = true; clearTimeout(timer); el.classList.add('sai'); setTimeout(() => el.remove(), 300); if (desfazerAtual === h) desfazerAtual = null; },
    desfaz() { if (feito) return; h.fecha(); fn(); },
  };
  b.addEventListener('click', () => h.desfaz());
  timer = setTimeout(h.fecha, ms); desfazerAtual = h;
}
export function desfazerUltimo() { if (!desfazerAtual) return false; desfazerAtual.desfaz(); return true; }
