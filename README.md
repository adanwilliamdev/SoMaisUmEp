# 🎬 SóMaisUmEp

<p align="center">
  <strong>Seu diário pessoal de séries e filmes.</strong>
  <br>
  Acompanhe episódios, temporadas, filmes assistidos, avaliações, tops 10 e estatísticas em um só lugar.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vers%C3%A3o-5.4-yellow?style=flat-square" alt="Versão 5.4">
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
- Tops 10 personalizados e compartilháveis.
- Estatísticas de tempo assistido e histórico.
- Descoberta de títulos e recomendações.
- Notificações de novos episódios.
- Importação de bibliotecas de outras plataformas.
- Backup e exportação de dados.
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
├── api/
│   ├── login.js
│   ├── cadastro.js
│   ├── logout.js
│   ├── dados.js
│   ├── sync.js
│   ├── capa.js
│   └── ...
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
│   └── acessibilidade.md
│
├── test/
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
- **`docs/`**: documentação técnica sobre notificações e acessibilidade.
- **`test/`**: testes automatizados executados pelo Node.js.

---

## 🚀 Funcionalidades

### 📚 Minha estante

- Cadastro e organização de séries e filmes.
- Pesquisa por nome.
- Filtros e ordenação por recentes, nome, nota e último episódio assistido.
- Seção para continuar assistindo.
- Acompanhamento individual do progresso de cada temporada.
- Identificação do próximo episódio.

### 📺 Integração com TMDb

- Busca de séries e filmes.
- Atualização automática de informações.
- Verificação diária de novas temporadas e episódios.
- Sinopses, capas e datas de lançamento.
- Informações sobre onde assistir no Brasil.
- Recomendações baseadas no histórico da biblioteca.

### 🔔 Lançamentos e notificações

- Identificação de novos episódios e estreias.
- Previsão de lançamento nos cards e detalhes.
- Seção de próximos episódios.
- Notificações dentro do aplicativo.
- Notificações push mesmo com o aplicativo fechado, quando configuradas.

### ⭐ Avaliações e Tops 10

- Avaliações individuais por título.
- Resenhas pessoais.
- Criação de múltiplas listas Top 10.
- Reordenação por arrastar e soltar ou controles de teclado.
- Compartilhamento por imagem PNG.
- Links públicos para compartilhar listas.

### 📊 Estatísticas

- Tempo total assistido.
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
- Tema claro e escuro.
- Funcionamento offline com os últimos dados sincronizados.
- Atualização automática dos recursos em cache.
- Barra lateral no desktop e navegação inferior no celular.
- Animações respeitando a preferência de redução de movimento.

### 🔐 Contas e segurança

- Cadastro e autenticação individual.
- Senhas protegidas com scrypt.
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

### Backend serverless

A API utiliza funções serverless da Vercel, com roteamento compartilhado por método HTTP.

Para respeitar o limite de 12 arquivos públicos de API do plano Hobby, funcionalidades relacionadas são organizadas em módulos internos, como:

- `api/_roteador.js`
- `api/_consultas.js`
- `api/_importar.js`
- `api/_pagina.js`
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
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
```

Entre na pasta:

```bash
cd SEU_REPOSITORIO
```

Instale as dependências:

```bash
npm install
```

### Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm test` | Executa os testes automatizados |
| `npm run lint` | Executa o ESLint |
| `npm run format` | Formata os arquivos com Prettier |
| `npm run format:check` | Verifica a formatação |
| `npm run verificar` | Executa lint, formatação e testes |
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
neon/migracoes/006_descricao.sql
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
3. Aplique a migração 005.
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

O projeto utiliza o test runner nativo do Node.js.

Os testes verificam regras de negócio, validações da API, estrutura do projeto e sincronização da biblioteca com um servidor simulado.

O GitHub Actions executa automaticamente:

- ESLint.
- Verificação do Prettier.
- Testes automatizados.
- Build de produção.

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
