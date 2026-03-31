"use client";

import { useState } from "react";
import Link from "next/link";
import { DashboardTopBar } from "@/components/DashboardTopBar";

const impactAreas = [
  {
    title: "Infraestrutura 24/7",
    description: "Servidores, backups e certificados para manter o painel seguro e o blog no ar.",
  },
  {
    title: "Novas funcionalidades",
    description: "Tempo de desenvolvimento para evoluir editor, integrações e automações de IA.",
  },
  {
    title: "Comunidade aberta",
    description: "Documentação, suporte e conteúdo educativo para quem está começando no Backblog.",
  },
];

const PIX_KEY_PLACEHOLDER = "backblog-chave-temporaria-123";

export default function DonatePage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY_PLACEHOLDER);
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
            O Backblog nasceu como um laboratório transparente para escrever com IA, sem fins comerciais. Toda ajuda
            cobre infraestrutura, tempo de desenvolvimento e ações para a comunidade. Se esse projeto te inspira, você
            pode contribuir financeiramente e acompanhar as entregas abertas no painel.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-100 hover:border-emerald-400"
            >
              Voltar para o site
            </Link>
            <a
              href="mailto:contato@backblog.dev"
              className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-950 hover:bg-emerald-300"
            >
              Preciso de recibo
            </a>
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
            Escolha um dos métodos abaixo. Após a contribuição, você pode enviar uma mensagem compartilhando ideias ou
            relatando o que gostaria de ver de novo no Backblog.
          </p>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">PIX (instantâneo)</p>
            <p className="mt-2 text-2xl font-semibold text-white break-all">{PIX_KEY_PLACEHOLDER}</p>
            <p className="mt-2 text-xs text-slate-400">
              Copie a chave acima e envie qualquer valor. Substituiremos pela chave oficial em breve.
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
            Transparência é prioridade: gastos com hospedagem, ferramentas e horas de desenvolvimento são publicados no
            painel. A chave mostrada acima é provisória — atualizaremos assim que definirmos a oficial.
          </p>
        </section>
      </main>
    </div>
  );
}
