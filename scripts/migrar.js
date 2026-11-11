#!/usr/bin/env node
// Migrações numeradas: neon/migracoes/NNN_nome.sql, aplicadas em ordem e uma única vez cada
// (controle na tabela `migracoes`). Cada arquivo roda numa transação: ou entra inteiro ou não entra.
//
//   npm run migrar            aplica o que falta no banco da DATABASE_URL
//   npm run schema            regenera neon/schema.sql (todas as migrações juntas, para o SQL Editor do Neon)
//
// Regra para os arquivos .sql: um comando por ";" e sem ";" dentro de texto ou de blocos $$ ... $$.
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'neon', 'migracoes');
const NOME = /^(\d{3})_[\w-]+\.sql$/;

const listar = () =>
  fs
    .readdirSync(DIR)
    .filter(f => NOME.test(f))
    .sort();
const ler = arq => fs.readFileSync(path.join(DIR, arq), 'utf8');
const idDe = arq => arq.replace(/\.sql$/, '');

// Divide o arquivo em comandos (ignora comentários "--").
function comandos(sql) {
  return sql
    .split('\n')
    .map(l => l.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map(c => c.trim())
    .filter(Boolean);
}

const CTRL = `create table if not exists migracoes (id text primary key, aplicada bigint not null)`;
const marca = id => `insert into migracoes (id, aplicada) values ('${id}', (extract(epoch from now()) * 1000)::bigint) on conflict (id) do nothing`;

// Conteúdo de neon/schema.sql: todas as migrações em sequência + o registro de que já foram aplicadas.
function schemaCompleto() {
  const partes = [
    '-- ARQUIVO GERADO por "npm run schema" a partir de neon/migracoes/. Não edite aqui: crie uma nova migração.\n-- Rode no SQL Editor do Neon. Seguro para rodar de novo e para atualizar um banco antigo.\n',
  ];
  for (const arq of listar()) partes.push(`-- ===== ${arq} =====\n${ler(arq).trim()}\n`);
  partes.push(
    `-- ===== controle de migrações =====\n${CTRL};\n${listar()
      .map(a => marca(idDe(a)) + ';')
      .join('\n')}\n`,
  );
  return partes.join('\n');
}

async function aplicar() {
  if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL (veja .env.example).');
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  const q = txt => sql(Object.assign([txt], { raw: [txt] })); // comando de texto puro, sem parâmetros
  await q(CTRL);
  const feitas = new Set((await q('select id from migracoes')).map(r => r.id));
  let n = 0;
  for (const arq of listar()) {
    const id = idDe(arq);
    if (feitas.has(id)) continue;
    process.stdout.write(`Aplicando ${arq}... `);
    await sql.transaction([...comandos(ler(arq)).map(q), q(marca(id))]);
    console.log('ok');
    n++;
  }
  console.log(n ? `${n} migração(ões) aplicada(s).` : 'Banco já está atualizado.');
}

if (require.main === module) {
  if (process.argv.includes('--gerar-schema')) {
    fs.writeFileSync(path.join(RAIZ, 'neon', 'schema.sql'), schemaCompleto());
    console.log('neon/schema.sql atualizado.');
  } else
    aplicar().catch(e => {
      console.error('Falhou:', e.message);
      process.exit(1);
    });
}

module.exports = { listar, ler, comandos, schemaCompleto };
