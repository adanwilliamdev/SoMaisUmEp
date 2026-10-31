import Link from "next/link";
import Image from "next/image";
import { img, rotuloTipo, type Resumo } from "@/lib/tipos";

type Acao = { rotulo: string; onClick: (t: Resumo) => void };

// Sem "use client": funciona tanto em páginas de servidor quanto dentro de componentes de cliente.
export default function Cards({ itens, acao }: { itens: Resumo[]; acao?: Acao }) {
  return (
    <div className="grade">
      {itens.map((t, i) => (
        <div key={`${t.tipo}-${t.id}`} className="card">
          <Link href={`/titulo/${t.tipo}/${t.id}`}>
            <div className="capa">
              {t.poster ? (
                <Image
                  src={img(t.poster, "w342")!}
                  alt={`Pôster de ${t.titulo}`}
                  fill
                  sizes="(max-width: 700px) 45vw, 200px"
                  priority={i < 6}
                />
              ) : (
                <span className="sem-poster" aria-hidden>🎬</span>
              )}
              {t.nota > 0 && <span className="nota">★ {t.nota}</span>}
            </div>
            <p>{t.titulo}</p>
            <small>{rotuloTipo(t.tipo)}{t.ano && ` • ${t.ano}`}</small>
          </Link>
          {acao && (
            <button type="button" className="btn-sec btn-card" onClick={() => acao.onClick(t)}>
              {acao.rotulo}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
