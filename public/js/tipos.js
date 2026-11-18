// Só tipos (JSDoc), sem código: descrevem os dados que o app e a API trocam. Os editores (VS Code etc.) usam isto para
// autocompletar e apontar erro de campo; `npm run tipos` confere regras.js, push.js e exportacao.js com o compilador do TypeScript.
// Na prática o formato é imposto no servidor por api/_validar.js (titulo, top).

/**
 * Próximo lançamento conhecido: data ISO (AAAA-MM-DD) e, quando se sabe, temporada e episódio.
 * @typedef {{ d: string, t?: number, e?: number }} Proximo
 */

/**
 * Situação escolhida pela pessoa para o que ainda não terminou (null = normal).
 * @typedef {'pausada' | 'abandonada'} Situacao
 */

/**
 * Série ou filme da estante.
 * @typedef {Object} Titulo
 * @property {string} id
 * @property {'tv' | 'movie'} [tipo] ausente vale 'tv'
 * @property {string} nome
 * @property {string | null} [capa] endereço da imagem (TMDb ou Vercel Blob)
 * @property {string | null} [sinopse]
 * @property {string | null} [ano]
 * @property {number | null} [nota] nota do TMDb (0 a 10)
 * @property {number | null} [duracao] minutos por episódio (filme: do filme todo)
 * @property {number | null} [tmdb] id no TMDb
 * @property {number[]} eps episódios de cada temporada (filme: [1])
 * @property {number[]} vis episódios vistos de cada temporada (mesmo tamanho de eps)
 * @property {number} criado quando foi adicionado (ms)
 * @property {number | null} [nota_pessoal] a nota da pessoa (0 a 10)
 * @property {string | null} [resenha]
 * @property {number | null} [visto_em] último episódio marcado (ms)
 * @property {Record<string, number>} [hist] episódios marcados por mês ("AAAA-MM")
 * @property {Proximo | null} [proximo]
 * @property {Situacao | null} [situacao]
 * @property {number} [atualizado] versão da linha no servidor (controle de edição simultânea); o app a guarda à parte
 */

/**
 * Uma posição do Top 10; `sid` liga ao título da estante, `obs` é a nota de rodapé.
 * @typedef {{ t: string, sid?: string | null, obs?: string }} ItemTop
 */

/**
 * @typedef {Object} Top
 * @property {string} id
 * @property {string} nome
 * @property {ItemTop[]} itens até 10
 * @property {number} criado
 */

/**
 * Resultado de `estatisticas`.
 * @typedef {{ episodios: number, filmes: number, concluidas: number, minutos: number, semDuracao: number, notaMedia: number | null, nNotas: number, porMes: Record<string, number> }} Estatisticas
 */

export {};
