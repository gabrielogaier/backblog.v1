import type { CSSProperties } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { HtmlContentWithCopy } from "@/components/HtmlContentWithCopy";
import { getBlogSettings, getPublishedPost } from "@/lib/publicApi";
import { sanitizeRichHtml } from "@/lib/sanitizeRichHtml";

export const revalidate = 60;

const defaultTheme = {
  primary: "#0f172a",
  secondary: "#14b8a6",
  background: "#050816",
  text: "#f8fafc",
  accent: "#22d3ee",
  codeBlockBackground: "#0f172a",
  codeInlineBackground: "#1e293b",
  codeText: "#e2e8f0",
  codeKeyword: "#7dd3fc",
  codeString: "#86efac",
  codeNumber: "#fbbf24",
  codeComment: "#94a3b8",
  codeFunction: "#c4b5fd",
};

type PostDetailsParams = { year: string; month: string; slug: string };

export async function generateMetadata({ params }: { params: Promise<PostDetailsParams> }): Promise<Metadata> {
  const resolvedParams = await params;
  const post = await getPublishedPost(Number(resolvedParams.year), Number(resolvedParams.month), resolvedParams.slug);
  if (!post) {
    return {
      title: "Post não encontrado | Backblog",
    };
  }

  return {
    title: `${post.title} | Backblog`,
    description: post.excerpt ?? "Post do Backblog com suporte a IA e revisões auditáveis.",
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
    },
  };
}

export default async function PostDetailsPage({ params }: { params: Promise<PostDetailsParams> }) {
  const resolvedParams = await params;
  const post = await getPublishedPost(Number(resolvedParams.year), Number(resolvedParams.month), resolvedParams.slug);
  if (!post) {
    notFound();
  }

  const settings = await getBlogSettings();
  const theme = settings?.theme ?? defaultTheme;
  const codeBlockBackground = theme.codeBlockBackground || defaultTheme.codeBlockBackground;
  const codeInlineBackground = theme.codeInlineBackground || defaultTheme.codeInlineBackground;
  const codeText = theme.codeText || defaultTheme.codeText;
  const codeKeyword = theme.codeKeyword || defaultTheme.codeKeyword;
  const codeString = theme.codeString || defaultTheme.codeString;
  const codeNumber = theme.codeNumber || defaultTheme.codeNumber;
  const codeComment = theme.codeComment || defaultTheme.codeComment;
  const codeFunction = theme.codeFunction || defaultTheme.codeFunction;
  const fallbackContactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "contato@backblog.dev";

  const htmlContent = sanitizeRichHtml(post.contentFinal ?? post.contentRaw ?? "");

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-8 lg:px-16">
      <main className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.5em] text-emerald-400">
            {settings?.blogTagline ?? "Blog pessoal com IA"}
          </p>
          <h1 className="text-4xl font-semibold text-white">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>
              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("pt-BR") : "Data indefinida"}
            </span>
            <span>·</span>
            <span>{post.readingTimeMin ? `${post.readingTimeMin} min de leitura` : "Tempo estimado indisponível"}</span>
          </div>
        </header>

        <HtmlContentWithCopy
          html={htmlContent}
          className="space-y-2 leading-relaxed text-slate-200 [&_h2]:mt-8 [&_h2]:text-3xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-2xl [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-400/70 [&_blockquote]:pl-4 [&_blockquote]:italic [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-[var(--post-code-block-border)] [&_pre]:bg-[var(--post-code-block-bg)] [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-[var(--post-code-text)] [&_pre]:shadow-[0_10px_28px_-16px_rgba(0,0,0,0.7)] [&_code]:rounded-md [&_code]:border [&_code]:border-[var(--post-code-inline-border)] [&_code]:bg-[var(--post-code-inline-bg)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.92em] [&_code]:text-[var(--post-code-text)] [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-2xl [&_table]:border [&_table]:border-[var(--post-table-border)] [&_th]:border [&_th]:border-[var(--post-table-border)] [&_th]:bg-[var(--post-table-header-bg)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-[var(--post-table-text)] [&_td]:border [&_td]:border-[var(--post-table-border)] [&_td]:bg-[var(--post-table-cell-bg)] [&_td]:px-3 [&_td]:py-2 [&_td]:text-[var(--post-table-text)]"
          style={
            {
              "--post-code-block-bg": codeBlockBackground,
              "--post-code-inline-bg": codeInlineBackground,
              "--post-code-text": codeText,
              "--post-code-block-border": `${codeText}44`,
              "--post-code-inline-border": `${codeText}33`,
              "--post-code-copy-bg": codeInlineBackground,
              "--post-code-copy-text": codeText,
              "--post-code-copy-border": `${codeText}66`,
              "--post-code-token-keyword": codeKeyword,
              "--post-code-token-string": codeString,
              "--post-code-token-number": codeNumber,
              "--post-code-token-comment": codeComment,
              "--post-code-token-function": codeFunction,
              "--post-table-border": `${theme.text}44`,
              "--post-table-header-bg": `${theme.primary}33`,
              "--post-table-cell-bg": `${theme.background}55`,
              "--post-table-text": theme.text,
            } as CSSProperties
          }
        />

        <section className="rounded-2xl border border-slate-900 bg-slate-900/60 p-5 text-xs uppercase tracking-[0.4em] text-slate-400">
          <p>
            Esse post fez parte do Backblog administrado por {settings?.blogName ?? "Backblog"}. Quer criar os seus?
            Fale com o admin em <strong>{settings?.contactEmail ?? fallbackContactEmail}</strong>.
          </p>
        </section>
      </main>
    </div>
  );
}
