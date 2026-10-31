import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { detalhes, NaoEncontrado } from "@/lib/tmdb";
import { formatarDuracao, img, rotuloTipo, type Detalhe, type Tipo } from "@/lib/tipos";
import Cards from "../../../Cards";
import BotaoLista from "../../../BotaoLista";
import Trailer from "../../../Trailer";

type Props = { params: { tipo: string; id: string } };

function validar(params: Props["params"]) {
  const id = Number(params.id);
  if ((params.tipo !== "movie" && params.tipo !== "tv") || !Number.isInteger(id) || id <= 0) return null;
  return { tipo: params.tipo as Tipo, id };
}

async function carregar(params: Props["params"]): Promise<Detalhe | null> {
  const v = validar(params);
  if (!v) return null;
  try {
    return await detalhes(v.tipo, v.id);
  } catch (e) {
    if (e instanceof NaoEncontrado) return null;
    throw e; // erro real: cai no error.tsx em vez de fingir que não existe
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await carregar(params).catch(() => null);
  if (!t) return { title: "Título não encontrado" };
  const descricao = t.sinopse ? t.sinopse.slice(0, 200) : `${rotuloTipo(t.tipo)} ${t.ano}`;
  const imagem = img(t.backdrop_path ?? t.poster_path, "w780");
  return {
    title: `${t.titulo}${t.ano ? ` (${t.ano})` : ""}`,
    description: descricao,
    openGraph: { title: t.titulo, description: descricao, images: imagem ? [imagem] : [] },
    twitter: { card: "summary_large_image" },
  };
}

const GRUPOS = [
  { categoria: "flatrate", rotulo: "Streaming" },
  { categoria: "rent", rotulo: "Alugar" },
  { categoria: "buy", rotulo: "Comprar" },
] as const;

export default async function TituloPagina({ params }: Props) {
  const t = await carregar(params);
  if (!t) notFound();

  const resumo = { id: t.tmdb_id, tipo: t.tipo, titulo: t.titulo, ano: t.ano, poster: t.poster_path, nota: t.nota ?? 0 };
  const meta = [
    rotuloTipo(t.tipo),
    t.ano,
    formatarDuracao(t.duracao),
    t.tipo === "tv" && t.temporadas ? `${t.temporadas} ${t.temporadas === 1 ? "temporada" : "temporadas"}` : "",
    t.status ?? "",
  ].filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": t.tipo === "tv" ? "TVSeries" : "Movie",
    name: t.titulo,
    description: t.sinopse ?? undefined,
    image: img(t.poster_path, "w500") ?? undefined,
    genre: t.generos,
    ...(t.nota && t.votos ? { aggregateRating: { "@type": "AggregateRating", ratingValue: t.nota, bestRating: 10, ratingCount: t.votos } } : {}),
    ...(t.direcao.length ? { director: t.direcao.map((name) => ({ "@type": "Person", name })) } : {}),
  };

  return (
    <article>
      {t.backdrop_path && (
        <div className="hero" aria-hidden>
          <Image src={img(t.backdrop_path, "w1280")!} alt="" fill sizes="100vw" priority />
        </div>
      )}
      <div className="detalhe">
        <div>
          {t.poster_path ? (
            <Image src={img(t.poster_path, "w500")!} alt={`Pôster de ${t.titulo}`} width={500} height={750} priority />
          ) : (
            <div className="capa sem-poster-grande" aria-hidden>🎬</div>
          )}
        </div>
        <div>
          <h1>{t.titulo}</h1>
          {t.titulo_original && t.titulo_original !== t.titulo && (
            <p className="original">Título original: {t.titulo_original}</p>
          )}
          {t.tagline && <p className="tagline">“{t.tagline}”</p>}
          <p className="meta">
            {meta.join(" • ")}
            {t.nota ? <span className="nota-grande"> ★ {t.nota}<small> ({t.votos.toLocaleString("pt-BR")} votos)</small></span> : null}
          </p>
          <div className="generos">{t.generos.map((g) => <span key={g}>{g}</span>)}</div>
          <p className="sinopse">{t.sinopse ?? "Este título ainda não tem sinopse em português."}</p>

          {t.direcao.length > 0 && (
            <p className="creditos"><strong>{t.tipo === "tv" ? "Criação" : "Direção"}:</strong> {t.direcao.join(", ")}</p>
          )}
          {t.tipo === "tv" && t.episodios ? (
            <p className="creditos"><strong>Episódios:</strong> {t.episodios}</p>
          ) : null}

          <div className="acoes">
            <BotaoLista titulo={resumo} />
            {t.imdb_id && (
              <a className="btn-sec" href={`https://www.imdb.com/title/${t.imdb_id}/`} target="_blank" rel="noopener noreferrer">IMDb ↗</a>
            )}
            <Link href="/" className="voltar">← Voltar</Link>
          </div>

          <section aria-labelledby="onde">
            <h2 id="onde">Onde assistir</h2>
            {t.provedores.length ? (
              <>
                {GRUPOS.map(({ categoria, rotulo }) => {
                  const lista = t.provedores.filter((p) => p.categoria === categoria);
                  if (!lista.length) return null;
                  return (
                    <div key={categoria} className="provedores">
                      <h3>{rotulo}</h3>
                      <ul>
                        {lista.map((p) => (
                          <li key={p.nome} title={p.nome}>
                            {p.logo ? <Image src={img(p.logo, "w92")!} alt={p.nome} width={46} height={46} /> : p.nome}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                <p className="fonte">
                  Disponibilidade no Brasil, via JustWatch.{" "}
                  {t.link_assistir && <a href={t.link_assistir} target="_blank" rel="noopener noreferrer">Ver detalhes ↗</a>}
                </p>
              </>
            ) : (
              <p className="vazio" style={{ padding: 0 }}>Sem informação de streaming no Brasil por enquanto.</p>
            )}
          </section>
        </div>
      </div>

      {t.trailer && (
        <section className="bloco" aria-labelledby="trailer">
          <h2 id="trailer">Trailer</h2>
          <Trailer chave={t.trailer} titulo={t.titulo} />
        </section>
      )}

      {t.elenco.length > 0 && (
        <section className="bloco" aria-labelledby="elenco">
          <h2 id="elenco">Elenco</h2>
          <ul className="elenco">
            {t.elenco.map((p) => (
              <li key={p.id}>
                {p.foto ? (
                  <Image src={img(p.foto, "w185")!} alt="" width={120} height={180} />
                ) : (
                  <div className="foto-vazia" aria-hidden>👤</div>
                )}
                <strong>{p.nome}</strong>
                {p.papel && <small>{p.papel}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {t.similares.length > 0 && (
        <section className="bloco" aria-labelledby="similares">
          <h2 id="similares">Você também pode gostar</h2>
          <Cards itens={t.similares} />
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </article>
  );
}
