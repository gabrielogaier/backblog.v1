"use client";

import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <PublicHeader />
      <main className="flex-1 px-6 py-12 sm:px-10">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-3xl border border-slate-900 bg-slate-900/70 px-6 py-8 shadow-lg shadow-slate-900/40 sm:px-10">
          <header className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Sobre o projeto</p>
            <h1 className="text-3xl font-semibold text-white">Backblog</h1>
          </header>

          <section className="space-y-4 text-sm leading-relaxed text-slate-200 sm:text-base">
            <p>
              Backblog é um espaço para registrar ideias antes que se percam. Um lugar onde anotações, experimentos,
              aprendizados e caminhos ainda inacabados podem existir sem a obrigação de estarem prontos.
            </p>
            <p>
              Aqui, o processo importa tanto quanto o resultado. Pensamentos podem ser revisitados, evoluídos ou
              simplesmente deixados como estavam, servindo como referência para você no futuro ou como ponto de partida
              para alguém que esteja buscando algo parecido.
            </p>
            <p>
              Mais do que um blog tradicional, o Backblog funciona como um repositório vivo de experiências. Um
              ambiente onde desenvolvedores podem acompanhar construções reais, se inspirar em soluções, adaptar ideias
              ou até contribuir com novas perspectivas.
            </p>
            <p>
              O projeto é desenvolvido de forma independente por Gabriel Gaier e está disponível publicamente em{" "}
              <a
                href="https://github.com/gabrielogaier/backblog.v1"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-emerald-300 underline decoration-emerald-500/60 underline-offset-4 hover:text-emerald-200"
              >
                github.com/gabrielogaier/backblog.v1
              </a>
              .
            </p>
            <p>
              Não possui fins lucrativos. Qualquer contribuição para manter o serviço ativo é bem-vinda.
            </p>
            <p>
              Não é sobre entregar versões finais. É sobre manter o movimento, registrar o caminho e permitir que
              outras pessoas caminhem junto.
            </p>
          </section>

          <div className="flex justify-center pt-2">
            <Link
              href="/doar"
              className="rounded-full border border-emerald-500/40 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300 hover:border-emerald-300"
            >
              Apoiar o projeto
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
