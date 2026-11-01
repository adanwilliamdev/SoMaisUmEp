export const $ = s => document.querySelector(s);
export const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => crypto.randomUUID();
export const hue = n => [...String(n)].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) % 360;

// Texto de status no rodapé
export function status(t, erro) { const el = $('#status'); if (el) { el.textContent = t; el.style.color = erro ? '#e5484d' : ''; } }

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
