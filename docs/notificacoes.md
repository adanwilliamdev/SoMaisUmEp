# Avisos de episódios novos (notificação push)

Uma vez por dia o servidor olha a estante de cada pessoa e, se algum título tem o próximo episódio (ou a estreia) **hoje**, manda uma notificação para os aparelhos em que ela ativou os avisos. Funciona com o app fechado.

## Como funciona

1. **Ativar** (Minha conta › Avisos de episódios novos): o navegador pede permissão, assina o serviço de push dele e o app envia a assinatura (`POST /api/dados?r=push`) para a tabela `push_assinaturas`.
2. **Atualizar datas**: o mesmo cron diário (`/api/cron`, 11:00 UTC = 08:00 em Brasília, veja `vercel.json`) começa chamando `api/_atualizar.js`, que consulta o TMDb e grava o próximo lançamento de cada título em `titulos.proximo`. Assim o aviso não depende de o app ter sido aberto (detalhes em "Verificação de datas no servidor", abaixo).
3. **Enviar**: em seguida o cron chama `api/_notificar.js`, que procura `titulos.proximo->>'d' = hoje` e envia uma notificação por aparelho. Cada aparelho recebe no máximo uma por dia (`ultimo_dia`).
4. **Mostrar**: o service worker (`public/sw.js`) recebe o evento `push` e mostra a notificação; tocar nela abre o app.

A mensagem é cifrada de ponta a ponta (RFC 8291) e a requisição é assinada com VAPID (RFC 8292). Tudo está em `api/_webpush.js`, só com o módulo `crypto` do Node, sem dependências. O teste `test/push.test.js` reproduz byte a byte o exemplo da RFC 8291.

## Verificação de datas no servidor

`api/_atualizar.js` roda a cada execução do cron, antes dos avisos:

- **Sem repetir consulta.** Os títulos de todas as contas são agrupados por `(tipo, tmdb)`: um título acompanhado por 50 pessoas custa uma consulta e atualiza as 50 linhas.
- **Fila com cursor.** A coluna `titulos.tmdb_verificado` (migração 006) guarda quando cada título foi consultado. Cada execução pega os verificados há mais tempo primeiro, até 60 títulos, em grupos de 5, e para ao passar de 12 s. O que não coube segue no dia seguinte.
- **Frequência.** Títulos com data de lançamento: a cada 20 h. Séries sem data (concluídas ou em hiato): a cada 6 dias. Filmes só enquanto têm estreia marcada.
- **O que sai hoje não é tocado.** O TMDb pode trocar o episódio de hoje pelo seguinte; atualizar antes do envio apagaria o aviso. No dia seguinte a data já passou e a linha é atualizada.
- **Falhas.** Um título que falha (ex.: removido do TMDb) é marcado como verificado sem alterar a data, para não travar a fila. Cinco falhas seguidas interrompem a rodada (TMDb fora do ar).
- **Conflitos.** Quando a data muda, `atualizado` sobe: os aparelhos abertos veem a data nova e, se tiverem edição pendente do mesmo título, o fluxo normal de conflito mantém a data do servidor.
- **Resposta do cron.** O campo `proximos` mostra `candidatos`, `consultados`, `atualizados`, `falhas` e se a rodada foi `interrompido`. Com um número alto de títulos, acompanhe `candidatos` e `interrompido` para saber se 60 por dia bastam (`max` em `atualizarProximos`).

A verificação não depende das chaves VAPID: com o TMDb configurado ela roda mesmo sem push, e as datas ficam em dia para o app.

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

Rode também `npm run migrar` (ou o `neon/schema.sql` no SQL Editor) para criar a tabela `push_assinaturas` (migração 005) e a coluna `tmdb_verificado` (migração 006). Sem as variáveis, os avisos ficam desligados e o resto do app funciona igual; em "Minha conta" aparece que o servidor não foi configurado.

Trocar o par de chaves invalida as inscrições antigas: o app detecta isso ao abrir e assina de novo sozinho, desde que a permissão continue concedida.

## Limites e cuidados

- **Defasagem de até um dia.** `titulos.proximo` é atualizado pelo cron (uma vez por dia) e pelo app quando é aberto. Um episódio que o TMDb anunciar com data para o mesmo dia, depois da execução das 11:00 UTC, só é visto no dia seguinte. Anúncios com pelo menos um dia de antecedência funcionam sem abrir o app.
- **Horário.** O plano Hobby da Vercel só aceita crons diários, e com margem de cerca de uma hora. O aviso é de manhã ("sai hoje"), não na hora exata do episódio.
- **iPhone e iPad** (iOS 16.4 ou mais novo) só recebem push com o app instalado na Tela de Início.
- **Serviços aceitos.** O servidor só envia para os endereços dos serviços de push dos navegadores (FCM, Mozilla, Apple, Windows). Qualquer outro endereço é recusado no cadastro e nunca é chamado (proteção contra SSRF). A lista está em `SERVICOS`, em `api/_webpush.js`.
- **Sair da conta** cancela os avisos naquele aparelho. Excluir a conta apaga as inscrições (`on delete cascade`). Cada conta guarda no máximo 10 aparelhos; os mais antigos saem.
- **Aviso de teste:** o botão em Minha conta envia uma notificação de verdade para o aparelho (no máximo 5 por 15 minutos).
