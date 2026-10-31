// Funções puras que transformam respostas do TMDb nos nossos tipos. Fáceis de testar.
import type { Detalhe, Pessoa, Provedor, Resumo, Tipo } from "./tipos";

export const arredondar = (n: unknown) => Math.round((Number(n) || 0) * 10) / 10;

const ano = (d: any) => String(d?.release_date || d?.first_air_date || "").slice(0, 4);

export function paraResumo(r: any, padrao?: Tipo): Resumo | null {
  if (!r || !r.id) return null;
  const tipo = r.media_type ?? padrao ?? (r.title ? "movie" : "tv");
  if (tipo !== "movie" && tipo !== "tv") return null;
  const titulo = r.title ?? r.name;
  if (!titulo) return null;
  return {
    id: r.id,
    tipo,
    titulo,
    ano: ano(r),
    poster: r.poster_path ?? null,
    nota: arredondar(r.vote_average),
  };
}

export function paraResumos(lista: any[] | undefined, padrao?: Tipo): Resumo[] {
  return (lista ?? []).map((r) => paraResumo(r, padrao)).filter((r): r is Resumo => r !== null);
}

/** Escolhe o melhor trailer do YouTube: oficial > português > qualquer um; "Teaser" como reserva. */
export function escolherTrailer(videos: any[] | undefined): string | null {
  const yt = (videos ?? []).filter((v) => v?.site === "YouTube" && v?.key);
  const pontuar = (v: any) => (v.official ? 2 : 0) + (v.iso_639_1 === "pt" ? 1 : 0);
  const melhor = (tipo: string) =>
    yt.filter((v) => v.type === tipo).sort((a, b) => pontuar(b) - pontuar(a))[0];
  return (melhor("Trailer") ?? melhor("Teaser"))?.key ?? null;
}

export function paraProvedores(
  wp: any,
  regiao = "BR"
): { provedores: Provedor[]; link: string | null } {
  const r = wp?.results?.[regiao];
  if (!r) return { provedores: [], link: null };
  const vistos = new Set<string>();
  const provedores: Provedor[] = [];
  for (const categoria of ["flatrate", "rent", "buy"] as const) {
    for (const p of r[categoria] ?? []) {
      if (!p?.provider_name || vistos.has(p.provider_name)) continue;
      vistos.add(p.provider_name);
      provedores.push({
        nome: p.provider_name,
        logo: p.logo_path ?? null,
        categoria,
      });
    }
  }
  return { provedores, link: r.link ?? null };
}

const STATUS: Record<string, string> = {
  Released: "Lançado",
  "Returning Series": "Em exibição",
  Ended: "Finalizada",
  Canceled: "Cancelada",
  "In Production": "Em produção",
  "Post Production": "Pós-produção",
  Planned: "Planejado",
  Rumored: "Rumor",
};

export function paraDetalhe(d: any, tipo: Tipo): Detalhe {
  const elenco: Pessoa[] = (d.credits?.cast ?? []).slice(0, 12).map((p: any) => ({
    id: p.id,
    nome: p.name,
    papel: p.character ?? "",
    foto: p.profile_path ?? null,
  }));

  const direcao: string[] =
    tipo === "movie"
      ? (d.credits?.crew ?? []).filter((c: any) => c.job === "Director").map((c: any) => c.name)
      : (d.created_by ?? []).map((c: any) => c.name);

  const { provedores, link } = paraProvedores(d["watch/providers"]);

  return {
    tmdb_id: d.id,
    tipo,
    titulo: d.title ?? d.name,
    titulo_original: (d.original_title ?? d.original_name) || null,
    tagline: d.tagline || null,
    sinopse: d.overview || null,
    ano: ano(d),
    generos: (d.genres ?? []).map((g: any) => g.name),
    duracao: d.runtime || d.episode_run_time?.[0] || d.last_episode_to_air?.runtime || null,
    poster_path: d.poster_path ?? null,
    backdrop_path: d.backdrop_path ?? null,
    nota: arredondar(d.vote_average),
    votos: d.vote_count ?? 0,
    status: d.status ? (STATUS[d.status] ?? d.status) : null,
    idioma: d.original_language ?? null,
    direcao: [...new Set<string>(direcao)],
    elenco,
    trailer: escolherTrailer(d.videos?.results),
    provedores,
    link_assistir: link,
    similares: paraResumos(d.similar?.results, tipo).slice(0, 12),
    temporadas: d.number_of_seasons ?? null,
    episodios: d.number_of_episodes ?? null,
    imdb_id: d.external_ids?.imdb_id || d.imdb_id || null,
  };
}
