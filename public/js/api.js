// Toda comunicação com o servidor. Erros trazem flags: auth (401), rede (sem conexão) e status.
export async function api(url, opt = {}) {
  let r;
  try {
    r = await fetch(url, {
      credentials: 'same-origin',
      method: opt.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opt.body ? JSON.stringify(opt.body) : undefined,
    });
  } catch (e) {
    throw Object.assign(new Error('Sem conexão com o servidor'), { rede: true });
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw Object.assign(new Error(j.erro || 'Não autorizado'), { auth: true, status: 401 });
  if (!r.ok) throw Object.assign(new Error(j.erro || 'Erro ' + r.status), { status: r.status });
  return j;
}
export const tmdb = params => api('/api/tmdb?' + new URLSearchParams(params));
