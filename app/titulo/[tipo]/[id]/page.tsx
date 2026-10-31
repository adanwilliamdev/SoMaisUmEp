import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { detalhes, img, type Tipo } from "@/lib/tmdb";

export default async function Titulo({ params }: { params: { tipo: string; id: string } }) {
  if (params.tipo !== "movie" && params.tipo !== "tv") notFound();
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  let t;
  try { t = await detalhes(params.tipo as Tipo, id); } catch { notFound(); }

  return (
    <main className="detalhe">
      <div>
        {t.poster_path && (
          <Image src={img(t.poster_path, "w500")!} alt={`Pôster de ${t.titulo}`} width={500} height={750} priority />
        )}
      </div>
      <div>
        <h1>{t.titulo}</h1>
        <p className="meta">
          {t.tipo === "tv" ? "Série" : "Filme"}
          {t.ano && ` • ${t.ano}`}
          {t.duracao ? ` • ${t.duracao} min` : ""}
          {t.nota ? ` • ★ ${t.nota}` : ""}
        </p>
        <div className="generos">{t.generos.map((g) => <span key={g}>{g}</span>)}</div>
        <p className="sinopse">{t.sinopse ?? "Este título ainda não tem sinopse em português."}</p>
        <Link href="/" className="voltar">Voltar para a busca</Link>
      </div>
    </main>
  );
}
