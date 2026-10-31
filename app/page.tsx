import Link from "next/link";
import type { Metadata } from "next";
import { buscar, ConfigError, generos, listar } from "@/lib/tmdb";
import { lerParametros, montarHref, ORDENS, type TipoLista } from "@/lib/params";
import type { Pagina, Resumo } from "@/lib/tipos";
import Cards from "./Cards";
import Paginacao from "./Paginacao";

type Props = { searchParams: Record<string, string | string[] | undefined> };

export function generateMetadata({ searchParams }: Props): Metadata {
  const { q } = lerParametros(searchParams);
  return q ? { title: `Busca: ${q}`, robots: { index: false } } : {};
}

const ABAS: { tipo: TipoLista; rotulo: string }[] = [
  { tipo: "all", rotulo: "Em alta" },
  { tipo: "movie", rotulo: "Filmes" },
  { tipo: "tv", rotulo: "Séries" },
];

export default async function Home({ searchParams }: Props) {
  const p = lerParametros(searchParams);

  let dados: Pagina<Resumo> | null = null;
  let lista: { id: number; name: string }[] = [];
  let aviso: string | null = null;
  try {
    [dados, lista] = await Promise.all([
      p.q ? buscar(p.q, p.pagina) : listar(p),
      !p.q && p.tipo !== "all" ? generos(p.tipo) : Promise.resolve([]),
    ]);
  } catch (e) {
    aviso =
      e instanceof ConfigError
        ? e.message
        : "Não conseguimos falar com o TMDb agora. Tente novamente em instantes.";
  }

  const generoAtual = lista.find((g) => g.id === p.genero)?.name;
  const titulo = p.q
    ? `Resultados para “${p.q}”`
    : p.tipo === "all"
      ? "Em alta esta semana"
      : `${p.tipo === "tv" ? "Séries" : "Filmes"} · ${ORDENS.find((o) => o.valor === p.ordem)!.rotulo.toLowerCase()}${generoAtual ? ` · ${generoAtual}` : ""}`;

  return (
    <main>
      <h1 className="frase">Qual é a história por trás do título?</h1>
      <form className="busca" action="/" role="search">
        <input name="q" defaultValue={p.q} placeholder="Busque um filme ou série" aria-label="Buscar filme ou série" maxLength={100} />
        <button type="submit">Buscar</button>
      </form>

      {!p.q && (
        <>
          <nav className="abas" aria-label="Categorias">
            {ABAS.map((a) => (
              <Link key={a.tipo} href={montarHref({ tipo: a.tipo })} aria-current={p.tipo === a.tipo ? "page" : undefined}>
                {a.rotulo}
              </Link>
            ))}
          </nav>
          {p.tipo !== "all" && (
            <form className="filtros" action="/">
              <input type="hidden" name="tipo" value={p.tipo} />
              <label>
                Ordenar por
                <select name="ordem" defaultValue={p.ordem}>
                  {ORDENS.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                </select>
              </label>
              <label>
                Gênero
                <select name="genero" defaultValue={p.genero ?? ""}>
                  <option value="">Todos</option>
                  {lista.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
              <button type="submit">Aplicar</button>
            </form>
          )}
        </>
      )}

      <h2>{titulo}</h2>
      {aviso ? (
        <p className="vazio" role="alert">{aviso}</p>
      ) : dados && dados.itens.length ? (
        <>
          <Cards itens={dados.itens} />
          <Paginacao params={p} total={dados.total} />
        </>
      ) : (
        <p className="vazio">Nada encontrado. Tente outro nome ou confira a grafia.</p>
      )}
    </main>
  );
}
