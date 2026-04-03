"use client";

import { useState } from "react";
import Link from "next/link";
import { DashboardTopBar } from "@/components/DashboardTopBar";

const impactAreas = [
  {
    title: "Serviço ativo",
    description: "Hospedagem, certificados, e-mail e manutenção para manter tudo estável no dia a dia.",
  },
  {
    title: "Evolução contínua",
    description: "Tempo de desenvolvimento para testar ideias novas e melhorar o projeto com consistência.",
  },
  {
    title: "Base aberta",
    description: "Código, documentação e caminhos reais para quem quer aprender ou construir algo parecido.",
  },
];

const PIX_KEY = "3ac7f6f6-97c7-4c30-8dfb-eacf6533465e";

export default function DonatePage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardTopBar backHref="/admin" backLabel="Painel" />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-8 lg:px-16">
        <header className="space-y-4 rounded-3xl border border-emerald-500/20 bg-slate-900/70 p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Faça uma doação</p>
          <h1 className="text-4xl font-semibold text-white">Ajude o Backblog a continuar independente</h1>
          <p className="text-sm text-slate-300">
            O Backblog é um projeto independente e sem fins lucrativos. A proposta é simples: manter um espaço vivo
            para registrar ideias, compartilhar construções reais e evoluir sem pressa de parecer pronto. Se isso faz
            sentido para você, qualquer apoio ajuda a manter o serviço ativo e o desenvolvimento em movimento.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-100 hover:border-emerald-400"
            >
              Voltar para o site
            </Link>
            <Link
              href="/sobre"
              className="rounded-full border border-emerald-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300 hover:border-emerald-300"
            >
              Ler sobre o projeto
            </Link>
          </div>
        </header>

        <section className="grid gap-4 rounded-3xl border border-slate-900 bg-slate-900/50 p-6 md:grid-cols-3">
          {impactAreas.map((area) => (
            <article key={area.title} className="space-y-2 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">{area.title}</p>
              <p className="text-sm text-slate-300">{area.description}</p>
            </article>
          ))}
        </section>

        <section className="space-y-4 rounded-3xl border border-slate-900 bg-slate-900/60 p-6">
          <h2 className="text-2xl font-semibold text-white">Como doar</h2>
          <p className="text-sm text-slate-400">
            A contribuição é direta por PIX. Sem assinatura, sem compromisso e sem burocracia. É só usar a chave
            abaixo no valor que você quiser.
          </p>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">PIX (instantâneo)</p>
            <p className="mt-2 text-2xl font-semibold text-white break-all">{PIX_KEY}</p>
            <p className="mt-2 text-xs text-slate-400">
              Copie a chave e envie quando fizer sentido para você. Toda contribuição ajuda a manter o Backblog no ar.
            </p>
            <button
              onClick={handleCopy}
              className="mt-4 rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-950 hover:bg-emerald-300"
            >
              {copied ? "Copiado ✔" : "Copiar chave"}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-900 bg-slate-900/40 p-6 text-sm text-slate-400">
          <p>
            Não é sobre correr para fechar versões finais. É sobre manter o caminho aberto, continuar construindo e
            deixar que outras pessoas acompanhem, adaptem e caminhem junto.
          </p>
        </section>
      </main>
    </div>
  );
}
