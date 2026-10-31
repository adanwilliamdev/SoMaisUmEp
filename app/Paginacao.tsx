import Link from "next/link";
import { montarHref, type Parametros } from "@/lib/params";

export default function Paginacao({ params, total }: { params: Parametros; total: number }) {
  if (total <= 1) return null;
  const { pagina } = params;
  return (
    <nav className="paginas" aria-label="Paginação">
      {pagina > 1 ? (
        <Link href={montarHref({ ...params, pagina: pagina - 1 })} rel="prev">← Anterior</Link>
      ) : <span aria-hidden />}
      <span>Página {pagina} de {total}</span>
      {pagina < total ? (
        <Link href={montarHref({ ...params, pagina: pagina + 1 })} rel="next">Próxima →</Link>
      ) : <span aria-hidden />}
    </nav>
  );
}
