// Notificações push: partes puras (sem DOM nem rede), para poderem ser testadas. A tela fica em telas/notificacoes.js.

// A chave pública do servidor vem em base64url; o navegador quer bytes.
export function chaveParaBytes(b64url) {
  const t = String(b64url).replace(/-/g, '+').replace(/_/g, '/'),
    bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

// Compara a chave com que o navegador assinou (ArrayBuffer ou null) com a chave atual do servidor.
export function mesmaChave(daAssinatura, bytes) {
  if (!daAssinatura) return false;
  const a = new Uint8Array(daAssinatura);
  return a.length === bytes.length && a.every((v, i) => v === bytes[i]);
}

// O que mostrar em "Minha conta". Entrada: { suporta, ios, instalado, permissao, chave, inscrito, erroServidor }.
// Saída: { estado, texto }, com estado em 'sem-suporte' | 'ios-instalar' | 'sem-servidor' | 'bloqueado' | 'ativo' | 'inativo'.
export function diagnostico({ suporta, ios, instalado, permissao, chave, inscrito, erroServidor }) {
  if (!suporta)
    return ios && !instalado
      ? { estado: 'ios-instalar', texto: 'No iPhone e no iPad os avisos só funcionam com o app instalado (iOS 16.4 ou mais novo): toque em Compartilhar › Adicionar à Tela de Início, abra o ícone novo e ative aqui.' }
      : { estado: 'sem-suporte', texto: 'Este navegador não oferece notificações push.' };
  if (erroServidor) return { estado: 'sem-servidor', texto: 'Não foi possível consultar o servidor agora. Tente de novo em instantes.' };
  if (!chave) return { estado: 'sem-servidor', texto: 'O envio de avisos ainda não foi configurado neste servidor (veja docs/notificacoes.md).' };
  if (permissao === 'denied') return { estado: 'bloqueado', texto: 'As notificações deste site estão bloqueadas no navegador. Libere nas permissões do site (o cadeado ao lado do endereço) e volte aqui.' };
  if (inscrito && permissao === 'granted') return { estado: 'ativo', texto: 'Ativados neste aparelho. De manhã, nos dias em que sai episódio novo (ou estreia) de algo da sua estante, você recebe uma notificação.' };
  return { estado: 'inativo', texto: 'Receba uma notificação de manhã nos dias em que sai episódio novo (ou estreia) de algo da sua estante, mesmo com o app fechado.' };
}
