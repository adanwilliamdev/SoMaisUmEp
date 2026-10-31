import Link from "next/link";
import Image from "next/image";
import { img, type Resumo } from "@/lib/tmdb";

export default function Cards({ itens }: { itens: Resumo[] }) {
  return (
    <div className="grade">
      {itens.map((t) => (
        <Link key={`${t.tipo}-${t.id}`} href={`/titulo/${t.tipo}/${t.id}`} className="card">
          <div className="capa">
            {t.poster && <Image src={img(t.poster)!} alt={`Pôster de ${t.titulo}`} fill sizes="200px" />}
            {t.nota > 0 && <span className="nota">★ {t.nota}</span>}
          </div>
          <p>{t.titulo}</p>
          <small>{t.tipo === "tv" ? "Série" : "Filme"}{t.ano && ` • ${t.ano}`}</small>
        </Link>
      ))}
    </div>
  );
}
