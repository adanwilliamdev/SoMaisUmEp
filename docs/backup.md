# Cópias de segurança e recuperação

Há duas camadas de proteção para os dados. Vale conhecer as duas, porque cobrem riscos diferentes.

## 1. Exportação pelo próprio app (por pessoa)

Em **Minha conta › Backup e exportação**, o app baixa um arquivo JSON com todos os seus dados (estante e tops). Ele também exporta em planilha CSV e no formato do Letterboxd. O JSON serve para:

- guardar uma cópia sua fora do serviço;
- mover os dados para outra conta ou instalação (o botão de importar valida e saneia tudo antes de usar);
- voltar atrás depois de um erro seu, como apagar um título sem querer.

Na importação, itens com o mesmo `id` são substituídos e os demais são mantidos. Faça uma exportação de vez em quando, principalmente antes de importar bibliotecas grandes ou mexer em muita coisa.

## 2. Banco de dados (Neon)

Os dados de todas as contas ficam no PostgreSQL do Neon.

**Restauração para um ponto no tempo.** O Neon guarda o histórico do banco e permite restaurar a um momento anterior. A janela de restauração depende do plano contratado: **confira no painel do projeto quantos dias ela cobre** e se isso basta para o seu caso. Perceber um erro depois dessa janela não tem volta pelo Neon, e é para isso que serve a cópia manual abaixo.

**Cópia manual (`pg_dump`).** Para ter uma cópia sua, independente do plano, rode de vez em quando (por exemplo, uma vez por mês) em um computador com o cliente PostgreSQL instalado:

```bash
pg_dump "$DATABASE_URL" --no-owner --format=custom --file="somaisumep-$(date +%F).dump"
```

Use a connection string **direta** do Neon (não a do pooler) e guarde o arquivo fora do repositório: ele contém e-mails e hashes de senha de todas as contas.

**Restaurar uma cópia** em um banco vazio (de preferência um projeto ou branch novo do Neon, para não sobrescrever o atual por engano):

```bash
pg_restore --no-owner --dbname="$DATABASE_URL_NOVO" somaisumep-2026-11-18.dump
```

## Teste a restauração

Uma cópia que nunca foi restaurada é só uma esperança. Pelo menos uma vez, restaure uma cópia em um banco de teste e confira se o app abre e mostra as séries. Para criar um banco vazio do zero (sem dados), use `npm run migrar` ou cole `neon/schema.sql` no editor SQL do Neon.

## O que não está coberto

- As capas enviadas ao Vercel Blob não entram no `pg_dump` (o banco guarda só o endereço delas). Se uma capa sumir, o botão "Atualizar do TMDb", no detalhe do título, busca os dados de novo.
- Variáveis de ambiente (como `SESSION_SECRET`) ficam na Vercel; anote-as em um gerenciador de senhas. Perder o `SESSION_SECRET` só desloga todo mundo, mas não perde dados.
