// Comparação de nomes sem acento, maiúsculas ou espaços repetidos (mesma regra do front, em CommonJS).
const normaliza = t => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
module.exports = { normaliza };
