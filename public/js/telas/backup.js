// Backup: baixar e importar um arquivo .json com todos os dados. Também exporta em formatos padrão (planilha CSV e Letterboxd).
import { $, aviso } from '../util.js';
import { L, save } from '../loja.js';
import { semDuplicados, limparTituloBackup, limparTopBackup } from '../regras.js';
import { planilha, letterboxd, filmesAssistidos } from '../exportacao.js';
import { dlg, ctx, gancho } from './ctx.js';

function abrirBackup() {
  ctx.aberta = null;
  dlg.innerHTML = `<h2>Backup</h2><p class="sub topo6">Baixe um arquivo com todos os seus dados ou importe um backup (inclusive o da versão antiga). Itens com o mesmo id são substituídos; os demais são mantidos.</p>
    <div class="rodape-dlg esq"><button class="btn" data-act="exportar">Baixar backup (.json)</button>
      <label class="btn sec arq">Importar arquivo…<input type="file" id="bkarq" accept=".json,application/json" class="sr-input"></label></div>
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

function importarBackup(texto) {
  let j;
  try {
    j = JSON.parse(texto);
    if (!j || !Array.isArray(j.series)) throw new Error('formato');
  } catch {
    aviso('Backup inválido.');
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
  const mescla = (novos, atuais) => {
    const ids = new Set(novos.map(x => x.id));
    return [...novos, ...atuais.filter(x => !ids.has(x.id))];
  };
  const { aceitos, repetidos } = semDuplicados(series, L.series);
  L.series = mescla(aceitos, L.series);
  L.tops = mescla(tops, L.tops);
  save();
  dlg.close();
  gancho.render();
  const notas = [];
  if (repetidos.length) notas.push(`${repetidos.length} ${repetidos.length === 1 ? 'título repetido foi ignorado' : 'títulos repetidos foram ignorados'}`);
  if (invalidos > 0) notas.push(`${invalidos} ${invalidos === 1 ? 'item inválido foi descartado' : 'itens inválidos foram descartados'}`);
  aviso(notas.length ? `Backup importado. ${notas.join('; ')}.` : 'Backup importado.');
}

dlg.addEventListener('change', e => {
  if (e.target.id !== 'bkarq' || !e.target.files[0]) return;
  const r = new FileReader();
  r.onload = () => importarBackup(String(r.result));
  r.readAsText(e.target.files[0]);
});

export const acoes = {
  backup: abrirBackup,
  exportar: exportarBackup,
  'exportar-csv': exportarCsv,
  'exportar-letterboxd': exportarLetterboxd,
  importar: () => importarBackup($('#bk').value),
};
