// Textos: comparação sem acento e escape de HTML (mesmas regras do front, em CommonJS).
const normaliza = t =>
  String(t == null ? '' : t)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Matiz (0-359) estável para um nome: cor do pôster provisório quando o título não tem capa.
const hue = n => [...String(n)].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) % 360;

module.exports = { normaliza, esc, hue };
