// Defesa extra contra CSRF: o cookie já é SameSite=Strict, mas pedidos que mudam dados (POST etc.) feitos por um navegador
// só passam se vierem do próprio site. Chamadas sem Origin (curl, testes, servidor a servidor) não são afetadas: não há
// cookie de sessão de outra pessoa nelas.
const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

const hostDe = v => {
  try {
    return new URL(String(v)).host.toLowerCase();
  } catch {
    return null;
  }
};

function origemOk(req) {
  if (SEGUROS.has(req.method)) return true;
  const h = req.headers || {};
  if (h['sec-fetch-site'] === 'cross-site') return false;
  const origem = h.origin;
  if (origem == null || origem === '') return true;
  const meu = String(h['x-forwarded-host'] || h.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const dela = hostDe(origem);
  return !!dela && (!meu || dela === meu);
}

module.exports = { origemOk };
