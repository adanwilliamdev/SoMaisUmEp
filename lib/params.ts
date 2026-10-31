// Leitura e validação dos parâmetros de URL da home (tudo vindo do usuário é validado aqui).
import type { Tipo } from "./tipos";

export type TipoLista = "all" | Tipo;
export type Ordem = "popular" | "avaliados" | "lancamentos";

export const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: "popular", rotulo: "Mais populares" },
  { valor: "avaliados", rotulo: "Mais bem avaliados" },
  { valor: "lancamentos", rotulo: "Lançamentos" },
];

export type Parametros = {
  q: string;
  tipo: TipoLista;
  ordem: Ordem;
  genero?: number;
  pagina: number;
};

type Bruto = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const MAX_PAGINAS = 500; // limite da API do TMDb

export function lerParametros(sp: Bruto): Parametros {
  const q = (um(sp.q) ?? "").trim().slice(0, 100);
  const t = um(sp.tipo);
  const tipo: TipoLista = t === "movie" || t === "tv" ? t : "all";
  const o = um(sp.ordem);
  const ordem = ORDENS.find((x) => x.valor === o)?.valor ?? "popular";
  const g = Number(um(sp.genero));
  const genero = Number.isInteger(g) && g > 0 ? g : undefined;
  const p = Number(um(sp.pagina));
  const pagina = Number.isInteger(p) && p >= 1 ? Math.min(p, MAX_PAGINAS) : 1;
  return { q, tipo, ordem, genero, pagina };
}

export function montarHref(p: Partial<Parametros>, base = "/"): string {
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.tipo && p.tipo !== "all") qs.set("tipo", p.tipo);
  if (p.ordem && p.ordem !== "popular") qs.set("ordem", p.ordem);
  if (p.genero) qs.set("genero", String(p.genero));
  if (p.pagina && p.pagina > 1) qs.set("pagina", String(p.pagina));
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}
