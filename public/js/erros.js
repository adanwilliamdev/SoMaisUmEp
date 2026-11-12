// Rede de segurança: erro inesperado não pode deixar o app "mudo". Mostra um aviso curto (no máximo um a cada 15 s)
// e deixa o detalhe no console. Nunca mostra a mensagem técnica na tela (pode conter dados internos).
const IGNORAR = /ResizeObserver loop|Script error\.?$/i;

export function instalarErros(avisar, alvo = globalThis, agora = Date.now) {
  let ultimo = -Infinity;
  const falar = () => {
    const t = agora();
    if (t - ultimo < 15000) return;
    ultimo = t;
    avisar('Algo deu errado. Se o problema continuar, recarregue a página.');
  };
  alvo.addEventListener('error', e => {
    if (IGNORAR.test(String((e && e.message) || ''))) return;
    console.error('erro não tratado:', (e && e.error) || (e && e.message));
    falar();
  });
  alvo.addEventListener('unhandledrejection', e => {
    const r = e && e.reason;
    if (r && (r.auth || r.rede)) return; // já tratados onde acontecem (faixa de "sem conexão", tela de login)
    console.error('promessa rejeitada:', r);
    falar();
  });
}
