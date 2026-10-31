import { describe, expect, it } from "vitest";
import { escolherTrailer, paraDetalhe, paraProvedores, paraResumo, paraResumos } from "../lib/mapeamento";
import { formatarDuracao, img } from "../lib/tipos";

describe("paraResumo", () => {
  it("converte um filme", () => {
    expect(paraResumo({ id: 1, title: "Matrix", release_date: "1999-03-31", poster_path: "/a.jpg", vote_average: 8.2649 })).toEqual({
      id: 1, tipo: "movie", titulo: "Matrix", ano: "1999", poster: "/a.jpg", nota: 8.3,
    });
  });
  it("converte uma série (media_type e first_air_date)", () => {
    const r = paraResumo({ id: 2, media_type: "tv", name: "Dark", first_air_date: "2017-12-01", vote_average: 0 });
    expect(r).toMatchObject({ tipo: "tv", titulo: "Dark", ano: "2017", nota: 0, poster: null });
  });
  it("descarta pessoas e itens sem título/id", () => {
    expect(paraResumo({ id: 3, media_type: "person", name: "Alguém" })).toBeNull();
    expect(paraResumo({ id: 4, media_type: "movie" })).toBeNull();
    expect(paraResumo({ title: "Sem id" })).toBeNull();
    expect(paraResumos([{ id: 3, media_type: "person", name: "x" }, { id: 5, title: "ok" }])).toHaveLength(1);
  });
  it("usa o tipo padrão quando a API não informa media_type", () => {
    expect(paraResumo({ id: 6, name: "Série" }, "tv")?.tipo).toBe("tv");
  });
});

describe("escolherTrailer", () => {
  it("prefere oficial em português, ignora não-YouTube e usa Teaser como reserva", () => {
    const v = [
      { site: "Vimeo", key: "v1", type: "Trailer", official: true },
      { site: "YouTube", key: "en", type: "Trailer", official: true, iso_639_1: "en" },
      { site: "YouTube", key: "pt", type: "Trailer", official: true, iso_639_1: "pt" },
      { site: "YouTube", key: "teaser", type: "Teaser", official: true },
    ];
    expect(escolherTrailer(v)).toBe("pt");
    expect(escolherTrailer([v[3]])).toBe("teaser");
    expect(escolherTrailer([])).toBeNull();
    expect(escolherTrailer(undefined)).toBeNull();
  });
});

describe("paraProvedores", () => {
  it("agrupa por categoria sem repetir o mesmo serviço", () => {
    const r = paraProvedores({
      results: { BR: { link: "https://jw", flatrate: [{ provider_name: "Netflix", logo_path: "/n.png" }], rent: [{ provider_name: "Netflix" }, { provider_name: "Apple TV" }] } },
    });
    expect(r.link).toBe("https://jw");
    expect(r.provedores.map((p) => `${p.categoria}:${p.nome}`)).toEqual(["flatrate:Netflix", "rent:Apple TV"]);
  });
  it("devolve vazio sem dados do Brasil", () => {
    expect(paraProvedores({ results: { US: {} } })).toEqual({ provedores: [], link: null });
    expect(paraProvedores(undefined)).toEqual({ provedores: [], link: null });
  });
});

describe("paraDetalhe", () => {
  it("monta um filme completo", () => {
    const d = paraDetalhe({
      id: 603, title: "Matrix", original_title: "The Matrix", overview: "Neo...", release_date: "1999-03-31", runtime: 136,
      genres: [{ name: "Ação" }], vote_average: 8.2, vote_count: 25000, status: "Released", tagline: "Bem-vindo",
      credits: { cast: Array.from({ length: 20 }, (_, i) => ({ id: i, name: `Ator ${i}`, character: "X", profile_path: null })), crew: [{ job: "Director", name: "Lana" }, { job: "Director", name: "Lana" }, { job: "Writer", name: "Z" }] },
      videos: { results: [{ site: "YouTube", key: "abc", type: "Trailer" }] },
      similar: { results: [{ id: 9, title: "Parecido" }] },
      external_ids: { imdb_id: "tt0133093" },
    }, "movie");
    expect(d).toMatchObject({ titulo: "Matrix", ano: "1999", duracao: 136, status: "Lançado", trailer: "abc", imdb_id: "tt0133093", direcao: ["Lana"] });
    expect(d.elenco).toHaveLength(12);
    expect(d.similares[0]).toMatchObject({ id: 9, tipo: "movie" });
  });
  it("monta uma série: criadores, temporadas e duração do episódio", () => {
    const d = paraDetalhe({
      id: 1, name: "Dark", first_air_date: "2017-12-01", episode_run_time: [], last_episode_to_air: { runtime: 55 },
      created_by: [{ name: "Baran" }], number_of_seasons: 3, number_of_episodes: 26, status: "Ended",
    }, "tv");
    expect(d).toMatchObject({ tipo: "tv", direcao: ["Baran"], temporadas: 3, episodios: 26, duracao: 55, status: "Finalizada", sinopse: null, trailer: null });
  });
});

describe("utilitários", () => {
  it("formatarDuracao", () => {
    expect(formatarDuracao(136)).toBe("2 h 16 min");
    expect(formatarDuracao(120)).toBe("2 h");
    expect(formatarDuracao(45)).toBe("45 min");
    expect(formatarDuracao(null)).toBe("");
    expect(formatarDuracao(0)).toBe("");
  });
  it("img", () => {
    expect(img("/a.jpg", "w185")).toBe("https://image.tmdb.org/t/p/w185/a.jpg");
    expect(img(null)).toBeNull();
  });
});
