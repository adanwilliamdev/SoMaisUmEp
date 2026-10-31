import "./globals.css";
import Link from "next/link";
import type { Metadata, Viewport } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Claquete — sinopses de filmes e séries", template: "%s • Claquete" },
  description: "Descubra filmes e séries, veja elenco, trailer, onde assistir e leia a sinopse em português.",
  openGraph: { siteName: "Claquete", locale: "pt_BR", type: "website" },
};

export const viewport: Viewport = { themeColor: "#14161f", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;800&family=Instrument+Sans:wght@400;600;700&display=swap"
        />
      </head>
      <body>
        <a href="#conteudo" className="pular">Pular para o conteúdo</a>
        <div className="wrap">
          <header className="topo">
            <Link href="/" className="marca"><i aria-hidden /> Claquete</Link>
            <nav className="menu" aria-label="Principal">
              <Link href="/">Início</Link>
              <Link href="/?tipo=movie">Filmes</Link>
              <Link href="/?tipo=tv">Séries</Link>
              <Link href="/minha-lista">Minha lista</Link>
            </nav>
          </header>
          <div id="conteudo">{children}</div>
          <footer className="rodape">
            <span>
              This product uses the TMDB API but is not endorsed or certified by TMDB.
              Dados de streaming por JustWatch.
            </span>
            {/* Baixe o logo oficial em themoviedb.org/about/logos-attribution e salve em /public/tmdb.svg */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tmdb.svg" alt="TMDB" />
          </footer>
        </div>
      </body>
    </html>
  );
}
