# 🎬 SóMaisUmEp

<p align="center">
  <strong>Seu diário pessoal de séries e filmes.</strong>
  <br>
  Acompanhe episódios, temporadas, filmes assistidos, avaliações, tops 10 e estatísticas em um só lugar.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vers%C3%A3o-6.0-c7321a?style=flat-square" alt="Versão 6.0">
  <img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel">
  <img src="https://img.shields.io/badge/PWA-Installable-5A0FC8?style=flat-square" alt="PWA">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License">
</p>

---

## 📖 Sobre o projeto

O **SóMaisUmEp** é uma aplicação web para organizar e acompanhar sua experiência com séries e filmes.

Cada usuário possui sua própria conta e biblioteca, podendo registrar episódios assistidos, acompanhar lançamentos, avaliar títulos, criar listas personalizadas e visualizar estatísticas de consumo.

A aplicação combina um frontend estático instalável como PWA, funções serverless da Vercel e banco de dados PostgreSQL hospedado no Neon.

### ✨ Principais recursos

- Acompanhamento de episódios e temporadas.
- Registro de filmes assistidos.
- Avaliações e resenhas pessoais.
- Hall da Fama: tops 10 pessoais, com nota de rodapé íntima em cada título, e compartilháveis.
- Estatísticas narradas como a sua história de espectador (estilo “Wrapped”).
- Radar de afinidade: sugestões cruzadas só com o seu histórico, sempre com o motivo.
- Notificações de novos episódios.
- Importação de bibliotecas de outras plataformas.
- Backup e exportação de dados.
- Sincronização incremental entre aparelhos (`/api/dados?desde=`): só o que mudou volta do servidor.
- Sincronização entre dispositivos.
- Instalação como aplicativo (PWA).
- Suporte a funcionamento offline.

---

## 🛠️ Tecnologias utilizadas

| Tecnologia | Aplicação |
|---|---|
| JavaScript | Lógica e funcionalidades do frontend |
| HTML5 | Estrutura das interfaces |
| CSS3 | Estilização e responsividade |
| Node.js | Scripts, testes e ferramentas de desenvolvimento |
| Vercel Functions | Backend serverless e endpoints da API |
| PostgreSQL | Persistência dos dados |
| Neon | Banco de dados PostgreSQL |
| TMDb API | Informações, imagens e lançamentos de títulos |
| Vercel Blob | Armazenamento opcional de capas |
| Service Worker | Cache e funcionamento offline |
| Web Push / VAPID | Notificações de episódios novos |
| Resend | Recuperação de senha por e-mail |
| ESLint | Análise estática do código |
| Prettier | Padronização da formatação |
| Node.js Test Runner | Testes automatizados |

---

## 📂 Estrutura do projeto

```text
├── public/
│   ├── index.html
│   ├── style.css
│   ├── tema.js
│   ├── manifest.json
│   ├── sw.js
│   ├── icons/
│   └── js/
│       ├── main.js
│       ├── loja.js
│       ├── regras.js
│       ├── views.js
│       ├── views/
│       └── telas/
│
├── api/                  (6 funções públicas; o resto começa com _ e não conta no limite da Vercel)
│   ├── auth.js           (login, logout, cadastro, esqueci, redefinir, conta)
│   ├── sync.js           (sincronização + envio de capa)
│   ├── dados.js          (biblioteca, health check e push)
│   ├── tmdb.js           (consultas TMDb + importação)
│   ├── t.js              (página pública dos tops + link de compartilhar)
│   ├── cron.js           (faxina e avisos diários)
│   ├── _h/               (handlers das ações de auth.js e sync.js)
│   └── _*.js             (módulos compartilhados)
│
├── neon/
│   ├── migracoes/
│   └── schema.sql
│
├── scripts/
│   ├── migrar.js
│   ├── build.js
│   └── vapid.js
│
├── docs/
│   ├── notificacoes.md
│   ├── acessibilidade.md
│   └── backup.md
│
├── test/
├── e2e/
├── integracao/
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── package.json
├── vercel.json
└── README.md
```

### Organização interna

- **`public/js/views/`**: componentes HTML responsáveis pela renderização de cada tela.
- **`public/js/telas/`**: módulos de eventos e ações de cada tela.
- **`api/`**: funções serverless responsáveis pela autenticação, sincronização e integração com serviços externos.
- **`neon/migracoes/`**: migrações SQL numeradas e versionadas.
- **`scripts/`**: automações para migração, build e geração de chaves VAPID.
- **`docs/`**: documentação técnica sobre notificações, acessibilidade, cópias de segurança e o design visual ([`docs/design.md`](docs/design.md)).
- **`public/fonts/`**: fonte Inter (subconjunto latino, licença OFL) hospedada no próprio site.
- **`test/`**: testes automatizados executados pelo Node.js (unitários, de API com banco simulado e de interface sem navegador).
- **`e2e/`**: testes de ponta a ponta no Chromium (Playwright), com a API simulada.
- **`integracao/`**: testes dos handlers contra um PostgreSQL de verdade (SQL do sync, migrações, cascata).

---

## 🚀 Funcionalidades

### 📚 Minha estante

- Cadastro e organização de séries e filmes.
- Pesquisa por nome.
- Filtros e ordenação por recentes, nome, nota e último episódio assistido.
- Seção para continuar assistindo.
- Grupos por estado na aba "Todas" (Assistindo, Na fila, Pausadas, Abandonadas, Concluídas), recolhíveis, com busca e filtros sempre à vista.
- Situação "pausada" ou "abandonada" (saem de "Continuar assistindo" até você marcar um episódio).
- −1 episódio direto no card e "Já vi antes" por temporada (marca sem contar como atividade de hoje).
- Acompanhamento individual do progresso de cada temporada.
- Identificação do próximo episódio.

### 📺 Integração com TMDb

- Busca de séries e filmes.
- Atualização automática de informações.
- Verificação diária de novas temporadas e episódios, feita pelo servidor (cron) e também pelo app quando é aberto.
- Sinopses, capas e datas de lançamento.
- Informações sobre onde assistir no Brasil.
- Radar de afinidade: diretores/criadores, elenco e gêneros que se repetem nos títulos que você concluiu ou avaliou com nota 7+ (`/api/tmdb?acao=afinidade`). Cada sugestão explica o porquê e traz o atalho de onde assistir.

### 🔔 Lançamentos e notificações

- Identificação de novos episódios e estreias.
- Previsão de lançamento nos cards e detalhes.
- Seção de próximos episódios.
- Notificações dentro do aplicativo.
- Notificações push mesmo com o aplicativo fechado, quando configuradas.

### ⭐ Avaliações e Tops 10

- Avaliações individuais por título.
- Resenhas pessoais.
- Criação de múltiplas listas Top 10 (o Hall da Fama).
- Nota de rodapé de até 160 caracteres em cada item (fica só com você: não vai para a imagem nem para o link público).
- Reordenação por arrastar e soltar ou controles de teclado.
- Compartilhamento por imagem PNG.
- Links públicos para compartilhar listas.

### 📊 Estatísticas

- Tempo total assistido, traduzido em dias inteiros e comparações tangíveis.
- Seu mês mais ativo e o título em que você mais investiu tempo.
- Seu jeito de avaliar: crítico rigoroso, equilibrado ou de coração generoso (e como você se compara ao TMDb).
- Quantidade de séries e filmes.
- Média das avaliações.
- Histórico mensal de atividades.
- Gráficos de acompanhamento.

### 📥 Importação de bibliotecas

Importação de dados das seguintes plataformas:

| Plataforma | Dados suportados |
|---|---|
| Letterboxd | Filmes assistidos, avaliações, diário, resenhas e watchlist |
| IMDb | Avaliações e watchlist |
| Trakt | Histórico, assistidos, avaliações e watchlist |

A importação utiliza a API do TMDb para localizar os títulos. Duplicados são ignorados e é possível desfazer uma importação completa.

### 💾 Backup e exportação

- Exportação completa da biblioteca em JSON.
- Restauração por meio de arquivos JSON.
- Exportação de planilhas CSV.
- Exportação de filmes no formato de importação do Letterboxd.
- Proteção contra execução de fórmulas em células CSV.

### 📱 PWA e experiência do usuário

- Instalação na tela inicial do celular.
- Interface responsiva para computadores, tablets e celulares.
- Tema claro (papel creme) e escuro (carvão quente), no visual "Bilheteria".
- Funcionamento offline com os últimos dados sincronizados.
- Atualização automática dos recursos em cache.
- Barra superior com abas no desktop e dock flutuante no celular.
- Animações respeitando a preferência de redução de movimento.

### 🔐 Contas e segurança

- Cadastro e autenticação individual.
- Senhas protegidas com scrypt no custo recomendado pela OWASP (N=2^17); os parâmetros ficam gravados no próprio hash, e hashes mais antigos são atualizados sozinhos no próximo login.
- Texto vindo de fora (TMDb, backups, o que a pessoa digita) é escapado por padrão ao montar HTML (`html```), com testes que travam o uso de `innerHTML` sem ele.
- CSP restrita: scripts, estilos e fontes só do próprio site, sem `unsafe-inline`.
- Bloqueio temporário contra tentativas de login.
- Recuperação de senha por e-mail.
- Alteração de senha e e-mail.
- Encerramento de sessões em todos os dispositivos.
- Exclusão completa da conta e dos respectivos dados.

### ♿ Acessibilidade

- Contraste AA nos temas.
- Indicadores de foco visíveis.
- Navegação por teclado.
- Identificação acessível de botões e diálogos.
- Alternativa em tabela para gráficos.
- Reordenação de listas sem depender de arrastar elementos.

Documentação: [`docs/acessibilidade.md`](docs/acessibilidade.md).

---

## 🏗️ Arquitetura e decisões técnicas

### Frontend modular

A aplicação utiliza módulos JavaScript separados por responsabilidade.

Cada tela possui dois módulos principais:

- `views/<tela>.js`: construção da interface HTML.
- `telas/<tela>.js`: gerenciamento dos eventos e ações.

As ações são exportadas por meio de `acoes` e registradas no `main.js`, utilizando atributos `data-act` para associar eventos aos elementos da interface.

O estado compartilhado fica centralizado em `telas/ctx.js`.

O HTML é montado com a função `html```, em `util.js`: tudo o que entra em `${...}` é escapado automaticamente, e trechos já seguros (outro `html``` ou um ícone SVG fixo marcado com `raw()`) entram sem novo escape. Listas são juntadas sozinhas, sem `.join('')`. O caminho mais curto é o seguro, e `test/html.test.js` falha se alguém voltar a montar `innerHTML` com template comum ou concatenação.

O `.prettierrc.json` usa `embeddedLanguageFormatting: "off"` de propósito: sem isso o Prettier reescreveria o HTML dentro dos templates `html```, mudando espaços e até fechando tags que são fragmentos de propósito.

Os formatos dos dados (`Titulo`, `Top`...) estão descritos em `public/js/tipos.js` (JSDoc), conferidos por `npm run tipos`.

### Backend serverless

A API utiliza funções serverless da Vercel, com roteamento compartilhado por método HTTP.

Para respeitar o limite de 12 arquivos públicos de API do plano Hobby, funcionalidades relacionadas são organizadas em módulos internos, como:

- `api/_roteador.js`
- `api/_consultas.js`
- `api/_importar.js`
- `api/_pagina.js`
- `api/_atualizar.js`
- `api/_compartilhar.js`

### Banco de dados e migrações

O PostgreSQL é hospedado no Neon.

As alterações estruturais são controladas por migrações SQL numeradas, permitindo atualizar o banco de maneira incremental e reproduzível.

O arquivo `neon/schema.sql` reúne todas as migrações para facilitar a configuração inicial.

### Sincronização e consistência

A aplicação implementa mecanismos para sincronização entre dispositivos.

- Recarregamento dos dados ao retornar à aba.
- Detecção de alterações concorrentes.
- Preservação do maior progresso de episódios por temporada.
- Controle de versão para exclusões.
- Salvamento com novas tentativas automáticas.
- ETag para evitar consultas desnecessárias à biblioteca.

### Cache e funcionamento offline

O Service Worker prioriza a rede para obter os módulos da mesma versão do deploy e utiliza os recursos armazenados quando não há conexão.

O processo de build gera automaticamente a versão do cache com base no commit do Git e na lista de módulos JavaScript.

A pasta `public/` permanece intacta durante o processo.

---

## ⚙️ Desenvolvimento

### Pré-requisitos

- Node.js.
- npm.
- Conta no [Neon](https://neon.tech/).
- Conta na [Vercel](https://vercel.com/).
- Token de leitura da API do [TMDb](https://www.themoviedb.org/).

### Instalação

Clone o repositório:

```bash
git clone https://github.com/<seu-usuario>/SoMaisUmEp.git
```

Entre na pasta:

```bash
cd SoMaisUmEp
```

Instale as dependências:

```bash
npm install
```

### Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm test` | Executa os testes automatizados (unitários, API simulada e views) |
| `npm run test:cobertura` | Testes com relatório de cobertura e mínimo exigido |
| `npm run e2e` | Testes de ponta a ponta no Chromium (veja "Testes e integração contínua") |
| `npm run test:integracao` | Testes contra um PostgreSQL de teste (precisa de `TEST_DATABASE_URL`) |
| `npm run lint` | Executa o ESLint |
| `npm run format` | Formata os arquivos com Prettier |
| `npm run format:check` | Verifica a formatação |
| `npm run tipos` | Confere os tipos JSDoc com o TypeScript |
| `npm run verificar` | Executa lint, formatação, tipos e testes |
| `npm run build` | Gera a pasta `dist/` |
| `npm run vapid` | Gera as chaves para notificações push |

Para executar a validação completa:

```bash
npm run verificar
```

---

## 🗄️ Configuração do banco de dados

### 1. Criar projeto no Neon

1. Acesse o [Neon Console](https://console.neon.tech/).
2. Crie um novo projeto.
3. Entre em **Connect**.
4. Copie a connection string pooled.
5. Utilize a string como variável `DATABASE_URL`.

### 2. Aplicar migrações

Método recomendado:

```bash
DATABASE_URL="sua_connection_string" npm run migrar
```

Alternativamente, execute o conteúdo de `neon/schema.sql` diretamente no SQL Editor do Neon.

As migrações são aplicadas em ordem e somente aquelas ainda não registradas são executadas.

### 3. Criar novas migrações

Crie um arquivo numerado dentro de:

```text
neon/migracoes/
```

Exemplo:

```text
neon/migracoes/008_descricao.sql
```

Depois, regenere o schema consolidado utilizando:

```bash
npm run schema
```

---

## 🔑 Configuração das variáveis de ambiente

Configure as variáveis em **Vercel → Settings → Environment Variables**.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SESSION_SECRET` | Sim | Segredo para proteção das sessões |
| `DATABASE_URL` | Sim | Connection string do Neon |
| `TMDB_READ_TOKEN` | Sim | Token de leitura da API TMDb |
| `TMDB_API_KEY` | Alternativa | Chave da API v3 do TMDb |
| `BLOB_READ_WRITE_TOKEN` | Não | Armazenamento de capas no Vercel Blob |
| `CRON_SECRET` | Sim | Proteção da execução do cron |
| `VAPID_PUBLIC_KEY` | Não | Chave pública para push |
| `VAPID_PRIVATE_KEY` | Não | Chave privada para push |
| `VAPID_SUBJECT` | Não | Identificação do remetente push |
| `APP_URL` | Não | URL pública da aplicação |
| `RESEND_API_KEY` | Não | Integração com Resend |
| `ALERTA_EMAIL` | Não | Recebe um e-mail quando o cron diário falha (usa o Resend) |
| `EMAIL_FROM` | Não | Endereço de envio dos e-mails |
| `ADOTAR_DADOS_ANTIGOS` | Não | Migração de dados de versões antigas |
| `CADASTRO_ABERTO` | Não | Controle de novos cadastros |

**Importante:** `APP_PASSWORD` não é mais utilizada. Após alterar variáveis de ambiente, realize um novo deploy.

---

## ☁️ Deploy na Vercel

1. Envie o projeto para o GitHub.
2. Acesse a [Vercel](https://vercel.com/).
3. Importe o repositório.
4. Selecione **Other** em Framework Preset.
5. Configure as variáveis de ambiente.
6. Verifique a conexão com o Neon.
7. Realize o deploy.

O comando de build é configurado pelo `vercel.json` e gera automaticamente a pasta `dist/`.

### Armazenamento de capas

O Vercel Blob é opcional.

Quando configurado, as capas enviadas pelos usuários são armazenadas no Blob, mantendo apenas os links no banco de dados.

Capas antigas em Base64 são migradas automaticamente em pequenos lotes.

Sem o Blob, o sistema continua funcionando utilizando o armazenamento no banco.

### Recuperação de senha por e-mail

Para habilitar:

1. Crie uma conta no [Resend](https://resend.com).
2. Verifique seu domínio.
3. Gere uma chave de API.
4. Configure `RESEND_API_KEY`, `EMAIL_FROM` e `APP_URL`.
5. Realize um novo deploy.

Os links de recuperação possuem validade de uma hora, são utilizados uma única vez e encerram as sessões abertas.

### Notificações push

Para habilitar as notificações:

1. Gere as chaves VAPID:

```bash
npm run vapid
```

2. Configure as variáveis VAPID na Vercel.
3. Aplique as migrações 005 e 006 (`npm run migrar`).
4. Realize um novo deploy.
5. Ative os avisos em **Minha conta → Avisos de episódios novos**.

Documentação completa: [`docs/notificacoes.md`](docs/notificacoes.md).

---

## 💻 Executar localmente

Para executar o projeto utilizando o ambiente de desenvolvimento da Vercel:

```bash
npm install
```

Instale a CLI:

```bash
npm i -g vercel
```

Vincule o projeto:

```bash
vercel link
```

Baixe as variáveis de ambiente:

```bash
vercel env pull .env.local
```

Inicie o ambiente:

```bash
vercel dev
```

---

## 🧪 Testes e integração contínua

O projeto usa o test runner nativo do Node.js, em quatro camadas:

| Camada | Comando | O que prova |
|---|---|---|
| Unitários e API simulada | `npm test` | Regras de negócio, validações, segurança (XSS, CSRF, senhas), cliente de sincronização e views, com banco e servidor falsos |
| Cobertura | `npm run test:cobertura` | Os mesmos testes, falhando se a cobertura cair abaixo do mínimo (hoje 50% de linhas, 65% de branches, 60% de funções; suba o piso quando melhorar) |
| Ponta a ponta | `npm run e2e` | Chromium de verdade: entrar, criar série, marcar episódio, recarregar, conflito entre aparelhos, texto malicioso, CSP sem violações e nenhum pedido a terceiros |
| Integração com banco | `npm run test:integracao` | Os handlers de `api/` contra um PostgreSQL real: `on conflict`, `unnest`, jsonb, migrações, cascata e limite de tentativas |

Antes do primeiro `npm run e2e`, instale o navegador uma vez: `npx playwright install chromium`.

Os testes de integração **apagam todas as tabelas** do banco indicado, por isso só aceitam uma `TEST_DATABASE_URL` cujo nome do banco contenha "test". Com o Docker:

```bash
docker run -d --name pg-teste -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=somaisumep_test -p 5432:5432 postgres:16
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/somaisumep_test npm run test:integracao
```

O GitHub Actions executa três jobs: `verificar` (ESLint, Prettier, tipos, testes com cobertura e build), `e2e` e `integracao` (com um PostgreSQL 16 como serviço). O Dependabot abre pull requests de atualização, que passam pela mesma CI.

O workflow está disponível em:

```text
.github/workflows/ci.yml
```

---

## 🔧 Solução de problemas

### Erro no servidor

Verifique:

1. Se o banco de dados está atualizado.
2. Se `DATABASE_URL` utiliza a connection string pooled.
3. Se as variáveis de ambiente estão configuradas em Production e Preview.
4. Se foi realizado um novo deploy após alterações nas variáveis.
5. Os logs em **Vercel → Deployments → Functions / Logs**.

### Cache e atualização

CSS e JavaScript são revalidados a cada abertura.

O Service Worker prioriza a rede e utiliza a cópia armazenada somente quando necessário.

A versão do cache é atualizada automaticamente durante o build. Não é necessário editar manualmente a variável `VERSAO`.

### Limites importantes

- A Vercel limita o corpo das requisições a 4,5 MB.
- Cada conta pode enviar até 30 capas por hora e armazenar até 1.000.
- A importação suporta até 4.000 títulos por hora, em lotes de 10.
- Uma execução de importação processa até 3.000 títulos.
- O cron diário executa às 11:00 UTC (08:00 em Brasília).

---

## 📝 Observações técnicas

- A sincronização entre dispositivos combina versões dos dados, preservando o maior progresso registrado por temporada.
- O controle de tentativas de login utiliza registros no PostgreSQL.
- O encerramento de todas as sessões utiliza uma versão de conta.
- A alteração de `SESSION_SECRET` invalida todas as sessões.
- A exclusão de títulos utiliza controle de versão para evitar remover alterações feitas em outro dispositivo.
- Alterar uma linha que já existe exige a versão atual (`base`); um pedido sem versão só consegue criar e, se a linha existir, vira conflito que o app resolve sozinho.
- Se o cron diário falha em alguma etapa, a execução termina com erro (HTTP 500, visível nos logs da Vercel), registra uma linha `[ALERTA]` e, com `ALERTA_EMAIL`, avisa por e-mail.
- A fonte Inter é hospedada em `public/fonts/` (nenhum pedido a terceiros para fontes ou CSS).
- Cópias de segurança do banco: veja [`docs/backup.md`](docs/backup.md).
- Os backups importados passam por validação e saneamento antes de serem exibidos ou persistidos.
- Os dados de streaming são fornecidos pelo JustWatch por meio do TMDb.
- A data de lançamento informada pelo TMDb representa a exibição original, podendo haver diferenças no lançamento por streaming no Brasil.

---

## 🙏 Créditos

Este produto utiliza a API do **[The Movie Database (TMDb)](https://www.themoviedb.org/)**, mas não é endossado nem certificado por ela.

Os dados de disponibilidade de streaming são fornecidos pelo JustWatch por meio do TMDb.

---

## 📄 Licença

Este projeto está licenciado sob a licença [MIT](LICENSE).

Copyright © 2026 Adan William Oliveira Santos.

Os dados e imagens fornecidos pelo TMDb estão sujeitos aos respectivos termos de uso.
