import { describe, expect, it } from "vitest";
import { lerParametros, montarHref } from "../lib/params";

describe("lerParametros", () => {
  it("usa padrões seguros para entradas vazias", () => {
    expect(lerParametros({})).toEqual({ q: "", tipo: "all", ordem: "popular", genero: undefined, pagina: 1 });
  });
  it("valida e normaliza entradas do usuário", () => {
    const p = lerParametros({ q: "  matrix  ", tipo: "tv", ordem: "avaliados", genero: "18", pagina: "3" });
    expect(p).toMatchObject({ q: "matrix", tipo: "tv", ordem: "avaliados", genero: 18, pagina: 3 });
  });
  it("rejeita valores inválidos e limita a página a 500", () => {
    const p = lerParametros({ tipo: "hack", ordem: "x", genero: "-1", pagina: "99999" });
    expect(p).toMatchObject({ tipo: "all", ordem: "popular", genero: undefined, pagina: 500 });
    expect(lerParametros({ pagina: "abc" }).pagina).toBe(1);
    expect(lerParametros({ pagina: "1.5" }).pagina).toBe(1);
  });
  it("corta buscas muito longas e aceita parâmetros repetidos", () => {
    expect(lerParametros({ q: "a".repeat(500) }).q).toHaveLength(100);
    expect(lerParametros({ tipo: ["movie", "tv"] }).tipo).toBe("movie");
  });
});

describe("montarHref", () => {
  it("omite valores padrão", () => {
    expect(montarHref({})).toBe("/");
    expect(montarHref({ tipo: "all", ordem: "popular", pagina: 1 })).toBe("/");
  });
  it("monta a query string e escapa a busca", () => {
    expect(montarHref({ q: "o poderoso chefão", pagina: 2 })).toBe("/?q=o+poderoso+chef%C3%A3o&pagina=2");
    expect(montarHref({ tipo: "movie", ordem: "lancamentos", genero: 28 })).toBe("/?tipo=movie&ordem=lancamentos&genero=28");
  });
});
