// Toda comunicação com o servidor. Erros trazem flags: auth (401), rede (sem conexão) e status.
export async function api(url, opt = {}) {
  // Prazo: sem ele, uma conexão que "pendura" trava a fila de salvamento para sempre.
  const ctl = new AbortController(),
    prazo = opt.prazo || 30000;
  let demorou = false;
  const timer = setTimeout(() => {
    demorou = true;
    ctl.abort();
  }, prazo);
  let r, j;
  try {
    r = await fetch(url, {
      signal: ctl.signal,
      credentials: 'same-origin',
      method: opt.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opt.body ? JSON.stringify(opt.body) : undefined,
    });
    j = await r.json().catch(() => ({}));
  } catch (e) {
    throw demorou
      ? Object.assign(new Error('O servidor demorou demais para responder'), { rede: true, demorou: true })
      : Object.assign(new Error('Sem conexão com o servidor'), { rede: true });
  } finally {
    clearTimeout(timer);
  }
  if (r.status === 401) throw Object.assign(new Error(j.erro || 'Não autorizado'), { auth: true, status: 401 });
  if (!r.ok) throw Object.assign(new Error(j.erro || 'Erro ' + r.status), { status: r.status });
  return j;
}
export const tmdb = params => api('/api/tmdb?' + new URLSearchParams(params));
