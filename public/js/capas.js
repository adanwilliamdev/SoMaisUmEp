// Capas enviadas por você: vão para o Vercel Blob (só o link fica no banco).
// Sem Blob configurado no servidor, continuam como imagem pequena dentro do banco.
import { api } from './api.js';
import { L, save } from './loja.js';

export async function enviarCapa(dataUrl) {
  if (!L.blob || !String(dataUrl).startsWith('data:')) return dataUrl;
  try {
    return (await api('/api/capa', { method: 'POST', body: { imagem: dataUrl } })).url;
  } catch (e) {
    return dataUrl;
  } // sem rede ou sem Blob: mantém no banco
}

// Move para o Blob as capas antigas que ainda estão em base64 (algumas por vez).
export async function migrarCapas(max = 6) {
  if (!L.blob || !navigator.onLine) return 0;
  let n = 0;
  for (const s of L.series.filter(x => x.capa && x.capa.startsWith('data:')).slice(0, max)) {
    const url = await enviarCapa(s.capa);
    if (url === s.capa) break;
    s.capa = url;
    n++;
    save();
  }
  return n;
}
