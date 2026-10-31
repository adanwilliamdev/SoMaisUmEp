import { buscar, emAlta } from "@/lib/tmdb";
import Cards from "./Cards";

export default async function Home({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();
  const itens = q ? await buscar(q) : await emAlta();

  return (
    <main>
      <h1 className="frase">Qual é a história por trás do título?</h1>
      <form className="busca" action="/" role="search">
        <input name="q" defaultValue={q} placeholder="Busque um filme ou série" aria-label="Buscar filme ou série" />
        <button type="submit">Buscar</button>
      </form>
      <h2>{q ? `Resultados para “${q}”` : "Em alta esta semana"}</h2>
      {itens.length ? <Cards itens={itens} /> : (
        <p className="vazio">Nada encontrado. Tente outro nome ou confira a grafia.</p>
      )}
    </main>
  );
}
