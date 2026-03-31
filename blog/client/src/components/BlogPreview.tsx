"use client";

import type { BlogSettings } from "@/types";

type BlogPreviewProps = {
  settings: BlogSettings;
};

export function BlogPreview({ settings }: BlogPreviewProps) {
  const { blogName, blogTagline, theme, seoDescription } = settings;
  const codeBlockBackground = theme.codeBlockBackground || "#0f172a";
  const codeInlineBackground = theme.codeInlineBackground || "#1e293b";
  const codeText = theme.codeText || "#e2e8f0";
  const codeKeyword = theme.codeKeyword || "#7dd3fc";
  const codeString = theme.codeString || "#86efac";
  const codeFunction = theme.codeFunction || "#c4b5fd";

  return (
    <div
      className="w-full rounded-3xl border border-slate-800 shadow-inner"
      style={{ backgroundColor: theme.background, color: theme.text }}
    >
      <header className="flex flex-col gap-4 border-b px-4 py-5 text-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: theme.secondary }}>
            preview
          </p>
          <h1 className="text-xl font-semibold" style={{ color: theme.primary }}>
            {blogName}
          </h1>
          {blogTagline ? <p className="text-xs opacity-80">{blogTagline}</p> : null}
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <nav className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.text }}>
            <button type="button" className="opacity-80 hover:opacity-100">
              Sobre
            </button>
            <button type="button" className="opacity-80 hover:opacity-100">
              Contato
            </button>
          </nav>
          <input
            type="search"
            placeholder="Buscar..."
            className="rounded-full border px-3 py-2 text-xs outline-none"
            style={{
              borderColor: `${theme.text}33`,
              color: theme.text,
              backgroundColor: theme.background,
            }}
          />
        </div>
      </header>

      <main className="space-y-4 px-4 py-6">
        <article className="rounded-2xl border px-4 py-5 shadow-sm" style={{ borderColor: `${theme.primary}22` }}>
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: theme.secondary }}>
            destaque
          </p>
          <h2 className="mt-2 text-lg font-semibold" style={{ color: theme.primary }}>
            Como equilibrar hábitos digitais e produtividade pessoal
          </h2>
          <p className="mt-2 text-sm opacity-80">
            {seoDescription ||
              "Mostre aqui um trecho do post principal para visualizar como as cores e tipografias aparecem no blog público."}
          </p>
          <button
            type="button"
            className="mt-4 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide"
            style={{ backgroundColor: theme.accent, color: theme.background }}
          >
            Ler mais
          </button>

          <div className="mt-5 space-y-2">
            <p className="text-xs uppercase tracking-[0.3em]" style={{ color: theme.secondary }}>
              bloco de código
            </p>
            <pre
              className="overflow-x-auto rounded-xl p-3 text-xs"
              style={{ backgroundColor: codeBlockBackground, color: codeText }}
            >
              <code>
                <span style={{ color: codeKeyword }}>const</span> <span style={{ color: codeFunction }}>tema</span> ={" "}
                <span style={{ color: codeString }}>&quot;personalizado&quot;</span>;
                {"\n"}
                <span style={{ color: codeFunction }}>console</span>.log(tema);
              </code>
            </pre>
            <p className="text-xs opacity-80">
              Exemplo inline:{" "}
              <code
                className="rounded px-1.5 py-0.5"
                style={{ backgroundColor: codeInlineBackground, color: codeText }}
              >
                npm run dev
              </code>
            </p>
          </div>
        </article>
      </main>
    </div>
  );
}
