// Backup: baixar e importar um arquivo .json com todos os dados. Também exporta em formatos padrão (planilha CSV e Letterboxd).
import { $, aviso } from '../util.js';
import { L, save } from '../loja.js';
import { semDuplicados, limparTituloBackup, limparTopBackup, ehBackupDoApp } from '../regras.js';
import { planilha, letterboxd, filmesAssistidos } from '../exportacao.js';
import { dlg, ctx, gancho } from './ctx.js';

function abrirBackup() {
  ctx.aberta = null;
  dlg.innerHTML = `<h2>Backup</h2><p class="sub topo6">Baixe um arquivo com todos os seus dados ou importe um backup (inclusive o da versão antiga). Itens com o mesmo id são substituídos; os demais são mantidos. Para listas do Letterboxd, IMDb ou Trakt, use “Importar lista” em Minha conta.</p>
    <div class="rodape-dlg esq"><button class="btn" data-act="exportar">Baixar backup (.json)</button>
      <label class="btn sec arq">Importar arquivo…<input type="file" id="bkarq" accept=".json,application/json,text/plain" class="sr-input"></label></div>
    <h3 class="topo6">Exportar para outros apps</h3>
    <p class="aviso">A planilha (.csv) abre no Excel, Google Planilhas e LibreOffice e leva todos os títulos. O arquivo do Letterboxd leva só os filmes que você assistiu, com nota e resenha; envie em letterboxd.com/import (séries não existem lá).</p>
    <div class="rodape-dlg esq"><button class="btn sec" data-act="exportar-csv">Planilha (.csv)</button><button class="btn sec" data-act="exportar-letterboxd">Letterboxd (.csv)</button></div>
    <details class="colar"><summary>Colar o texto de um backup</summary>
      <textarea id="bk" aria-label="Texto do backup" placeholder="Cole aqui o conteúdo do backup"></textarea>
      <div class="rodape-dlg"><button class="btn sec" data-act="importar">Importar texto</button></div></details>
    <div class="rodape-dlg"><button class="btn sec" data-act="fechar">Fechar</button></div>`;
  dlg.showModal();
}

// Baixa um texto como arquivo (a URL temporária é liberada depois).
function baixar(nome, texto, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: tipo }));
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const hoje = () => new Date().toISOString().slice(0, 10);

function exportarBackup() {
  const dados = { app: 'somaisumep', versao: 4, exportado: new Date().toISOString(), series: L.series, tops: L.tops };
  baixar(`somaisumep-backup-${hoje()}.json`, JSON.stringify(dados, null, 2), 'application/json');
}

function exportarCsv() {
  if (!L.series.length) {
    aviso('Sua estante está vazia: não há o que exportar.');
    return;
  }
  baixar(`somaisumep-planilha-${hoje()}.csv`, planilha(L.series), 'text/csv;charset=utf-8');
  aviso(`${L.series.length} ${L.series.length === 1 ? 'título exportado' : 'títulos exportados'} para a planilha.`);
}

function exportarLetterboxd() {
  const n = filmesAssistidos(L.series).length;
  if (!n) {
    aviso('Nenhum filme assistido para exportar. O Letterboxd só recebe filmes.');
    return;
  }
  baixar(`somaisumep-letterboxd-${hoje()}.csv`, letterboxd(L.series), 'text/csv;charset=utf-8');
  aviso(`${n} ${n === 1 ? 'filme exportado' : 'filmes exportados'} para o Letterboxd (séries não entram).`);
}

const qtd = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Restaura um backup (texto JSON). Também é usada pelo importador de outros apps quando o arquivo escolhido é um backup do próprio app.
export function importarBackup(texto) {
  let j;
  try {
    j = JSON.parse(String(texto).replace(/^\uFEFF/, ''));
  } catch {
    aviso('Não consegui ler o arquivo: ele não é um JSON válido.');
    return;
  }
  if (!ehBackupDoApp(j)) {
    aviso('Este arquivo não parece um backup do SóMaisUmEp. Para listas do Letterboxd, IMDb ou Trakt, use “Importar lista” em Minha conta.');
    return;
  }
  // Cada item passa pelo saneamento (ids, números, capas, textos) antes de entrar no app; o que não passar é descartado.
  const t0 = Date.now(),
    MAX_SERIES = 5000,
    MAX_TOPS = 200;
  const recebidos = j.series.length + (Array.isArray(j.tops) ? j.tops.length : 0);
  const series = j.series
    .slice(0, MAX_SERIES)
    .map((x, i) => limparTituloBackup(x, t0 - i))
    .filter(Boolean);
  const tops = (Array.isArray(j.tops) ? j.tops : [])
    .slice(0, MAX_TOPS)
    .map((x, i) => limparTopBackup(x, t0 - i))
    .filter(Boolean);
  const invalidos = recebidos - series.length - tops.length;
  if (!series.length && !tops.length) {
    aviso(recebidos ? 'Nenhum item válido no arquivo: o backup parece corrompido.' : 'O backup está vazio: não há títulos para importar.');
    return;
  }
  const mescla = (novos, atuais) => {
    const ids = new Set(novos.map(x => x.id));
    return [...novos, ...atuais.filter(x => !ids.has(x.id))];
  };
  const { aceitos, repetidos } = semDuplicados(series, L.series);
  L.series = mescla(aceitos, L.series);
  L.tops = mescla(tops, L.tops);
  save();
  if (dlg.open) dlg.close();
  gancho.render();
  const feito = [qtd(aceitos.length, 'título', 'títulos'), tops.length ? qtd(tops.length, 'top', 'tops') : ''].filter(Boolean).join(' e ');
  const notas = [];
  if (repetidos.length) notas.push(`${repetidos.length} ${repetidos.length === 1 ? 'título repetido foi ignorado' : 'títulos repetidos foram ignorados'}`);
  if (invalidos > 0) notas.push(`${invalidos} ${invalidos === 1 ? 'item inválido foi descartado' : 'itens inválidos foram descartados'}`);
  aviso(`Backup importado: ${feito}.${notas.length ? ' ' + notas.join('; ') + '.' : ''}`, notas.length ? 8000 : undefined);
}

dlg.addEventListener('change', e => {
  if (e.target.id !== 'bkarq' || !e.target.files[0]) return;
  const campo = e.target,
    r = new FileReader();
  r.onload = () => importarBackup(String(r.result));
  r.onerror = () => aviso('Não foi possível ler o arquivo.');
  r.readAsText(campo.files[0]);
  campo.value = ''; // permite escolher o mesmo arquivo de novo
});

export const acoes = {
  backup: abrirBackup,
  exportar: exportarBackup,
  'exportar-csv': exportarCsv,
  'exportar-letterboxd': exportarLetterboxd,
  importar: () => importarBackup($('#bk').value),
};
