# Avisos de episódios novos (notificação push)

Uma vez por dia o servidor olha a estante de cada pessoa e, se algum título tem o próximo episódio (ou a estreia) **hoje**, manda uma notificação para os aparelhos em que ela ativou os avisos. Funciona com o app fechado.

## Como funciona

1. **Ativar** (Minha conta › Avisos de episódios novos): o navegador pede permissão, assina o serviço de push dele e o app envia a assinatura (`POST /api/dados?r=push`) para a tabela `push_assinaturas`.
2. **Enviar**: o cron diário (`/api/cron`, 11:00 UTC = 08:00 em Brasília, veja `vercel.json`) chama `api/_notificar.js`, que procura `titulos.proximo->>'d' = hoje` e envia uma notificação por aparelho. Cada aparelho recebe no máximo uma por dia (`ultimo_dia`).
3. **Mostrar**: o service worker (`public/sw.js`) recebe o evento `push` e mostra a notificação; tocar nela abre o app.

A mensagem é cifrada de ponta a ponta (RFC 8291) e a requisição é assinada com VAPID (RFC 8292). Tudo está em `api/_webpush.js`, só com o módulo `crypto` do Node, sem dependências. O teste `test/push.test.js` reproduz byte a byte o exemplo da RFC 8291.

## Configurar

```
npm run vapid
```

Cole as três linhas nas variáveis de ambiente da Vercel (e em `.env.local`, se for rodar localmente) e faça um **Redeploy**:

| Variável | Valor |
|---|---|
| `VAPID_PUBLIC_KEY` | chave pública gerada |
| `VAPID_PRIVATE_KEY` | chave privada gerada (segredo) |
| `VAPID_SUBJECT` | `mailto:voce@exemplo.com` (ou o endereço https do site) |
| `FUSO_AVISOS` | *(opcional)* fuso que define o que é "hoje"; padrão `America/Sao_Paulo` |

Rode também `npm run migrar` (ou o `neon/schema.sql` no SQL Editor) para criar a tabela `push_assinaturas` (migração 005). Sem as variáveis, os avisos ficam desligados e o resto do app funciona igual; em "Minha conta" aparece que o servidor não foi configurado.

Trocar o par de chaves invalida as inscrições antigas: o app detecta isso ao abrir e assina de novo sozinho, desde que a permissão continue concedida.

## Limites e cuidados

- **A data vem do app.** `titulos.proximo` é atualizado quando o app é aberto (consulta ao TMDb). Um lançamento que o TMDb só anunciou depois da última abertura não gera aviso. Datas já conhecidas funcionam mesmo sem abrir o app.
- **Horário.** O plano Hobby da Vercel só aceita crons diários, e com margem de cerca de uma hora. O aviso é de manhã ("sai hoje"), não na hora exata do episódio.
- **iPhone e iPad** (iOS 16.4 ou mais novo) só recebem push com o app instalado na Tela de Início.
- **Serviços aceitos.** O servidor só envia para os endereços dos serviços de push dos navegadores (FCM, Mozilla, Apple, Windows). Qualquer outro endereço é recusado no cadastro e nunca é chamado (proteção contra SSRF). A lista está em `SERVICOS`, em `api/_webpush.js`.
- **Sair da conta** cancela os avisos naquele aparelho. Excluir a conta apaga as inscrições (`on delete cascade`). Cada conta guarda no máximo 10 aparelhos; os mais antigos saem.
- **Aviso de teste:** o botão em Minha conta envia uma notificação de verdade para o aparelho (no máximo 5 por 15 minutos).
