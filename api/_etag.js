// ETag barato para /api/dados: em vez de montar a biblioteca inteira, o servidor compara só
// contagem e última alteração (campo `atualizado`) dos títulos e tops. Sem mudança => 304, sem corpo.
const crypto = require('crypto');

const etagDe = (...partes) => 'W/"' + crypto.createHash('sha256').update(partes.join('|')).digest('base64url').slice(0, 24) + '"';

const semFraco = t => String(t).trim().replace(/^W\//, '');
// If-None-Match pode trazer vários valores ou "*"; a comparação é a "fraca" (ignora o prefixo W/).
const confere = (req, tag) => String(req.headers['if-none-match'] || '').split(',').some(t => t.trim() === '*' || (t.trim() && semFraco(t) === semFraco(tag)));

module.exports = { etagDe, confere };
