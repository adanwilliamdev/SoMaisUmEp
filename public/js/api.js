// Toda comunicação com o servidor. Erros trazem flags: auth (401), rede (sem conexão ou demora) e status.
// Sem prazo, um pedido pendurado (rede móvel instável) deixaria a fila de salvamento travada para sempre.
export const PRAZO_MS = 25000;

export async function api(url, opt = {}) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), opt.prazo || PRAZO_MS) : null;
  let r;
  try {
    r = await fetch(url, {
      credentials: 'same-origin',
      method: opt.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opt.body ? JSON.stringify(opt.body) : undefined,
      signal: ctl ? ctl.signal : undefined,
    });
  } catch (e) {
    const demorou = e && e.name === 'AbortError';
    throw Object.assign(new Error(demorou ? 'O servidor demorou para responder' : 'Sem conexão com o servidor'), { rede: true, demorou });
  } finally {
    clearTimeout(timer);
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw Object.assign(new Error(j.erro || 'Não autorizado'), { auth: true, status: 401 });
  if (!r.ok) throw Object.assign(new Error(j.erro || 'Erro ' + r.status), { status: r.status });
  return j;
}
export const tmdb = params => api('/api/tmdb?' + new URLSearchParams(params));
