// Gera a pasta dist/ a partir de public/ e carimba o service worker com a versão do deploy.
// Na Vercel roda como buildCommand (veja vercel.json) e usa VERCEL_GIT_COMMIT_SHA; localmente: `npm run build`.
// public/ nunca é alterada: a versão só existe em dist/sw.js, então não sobra diff no git.
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

// Todos os arquivos .js dentro de js/ (caminhos como o navegador pede: "/js/telas/estante.js").
function modulos(pasta) {
  const achados = [];
  const andar = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name.endsWith('.js')) achados.push('/' + path.relative(pasta, p).split(path.sep).join('/'));
    }
  };
  andar(path.join(pasta, 'js'));
  return achados;
}

// "somaisumep-<commit>": só letras, números e hífen, para servir de nome de cache.
function versao(sha, agora = Date.now()) {
  const limpo = String(sha || '')
    .replace(/[^\w-]/g, '')
    .slice(0, 10);
  return 'somaisumep-' + (limpo || 'local' + agora.toString(36));
}

function construir({ origem = path.join(RAIZ, 'public'), destino = path.join(RAIZ, 'dist'), sha = process.env.VERCEL_GIT_COMMIT_SHA } = {}) {
  fs.rmSync(destino, { recursive: true, force: true });
  fs.cpSync(origem, destino, { recursive: true });
  const arq = path.join(destino, 'sw.js');
  let sw = fs.readFileSync(arq, 'utf8');
  const nome = versao(sha),
    lista = modulos(destino);
  const troca = (re, novo) => {
    if (!re.test(sw)) throw new Error('sw.js: não achei ' + re);
    sw = sw.replace(re, () => novo);
  };
  troca(/const VERSAO = '[^']*';/, `const VERSAO = '${nome}';`);
  troca(/const MODULOS = \[[^\]]*\];/, `const MODULOS = ${JSON.stringify(lista)};`);
  fs.writeFileSync(arq, sw);
  return { versao: nome, modulos: lista, destino };
}

module.exports = { construir, versao, modulos };

if (require.main === module) {
  const r = construir();
  console.log(`dist/ pronto: ${r.versao}, ${r.modulos.length} módulos no cache offline`);
}
