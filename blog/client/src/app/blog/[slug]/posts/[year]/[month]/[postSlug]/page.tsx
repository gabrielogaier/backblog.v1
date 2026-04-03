import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateBR } from "@/lib/dateTime";
import { getAuthorBlog, getAuthorPublishedPost, getPostEngagement } from "@/lib/publicApi";
import { rewriteStorageAssetUrls, sanitizeRichHtml } from "@/lib/sanitizeRichHtml";
import { AuthorBlogHeader } from "@/components/AuthorBlogHeader";
import { HtmlContentWithCopy } from "@/components/HtmlContentWithCopy";
import { PostEngagementPanel } from "@/components/PostEngagementPanel";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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

type AuthorPostParams = {
  slug: string;
  year: string;
  month: string;
  postSlug: string;
};

async function fetchBlog(slug: string) {
  try {
    return await getAuthorBlog(slug, { limit: 1 });
  } catch {
    return null;
  }
}

async function fetchAuthorPost(slug: string, year: number, month: number, postSlug: string) {
  try {
    return await getAuthorPublishedPost(slug, year, month, postSlug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<AuthorPostParams> }): Promise<Metadata> {
  const resolved = await params;
  const post = await fetchAuthorPost(
    resolved.slug,
    Number(resolved.year),
    Number(resolved.month),
    resolved.postSlug,
  );
  if (!post) {
    return { title: "Post não encontrado | Backblog" };
  }
  return {
    title: `${post.title} | Backblog`,
    description: post.excerpt ?? "Post do Backblog",
  };
}

export default async function AuthorPostPage({ params }: { params: Promise<AuthorPostParams> }) {
  const { slug, year, month, postSlug } = await params;
  const blog = await fetchBlog(slug);
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const post = await fetchAuthorPost(slug, numericYear, numericMonth, postSlug);

  if (!blog || !post) {
    notFound();
  }

  const theme = blog.settings?.theme ?? defaultTheme;
  const codeBlockBackground = theme.codeBlockBackground || defaultTheme.codeBlockBackground;
  const codeInlineBackground = theme.codeInlineBackground || defaultTheme.codeInlineBackground;
  const codeText = theme.codeText || defaultTheme.codeText;
  const codeKeyword = theme.codeKeyword || defaultTheme.codeKeyword;
  const codeString = theme.codeString || defaultTheme.codeString;
  const codeNumber = theme.codeNumber || defaultTheme.codeNumber;
  const codeComment = theme.codeComment || defaultTheme.codeComment;
  const codeFunction = theme.codeFunction || defaultTheme.codeFunction;
  const aboutText = blog.settings?.aboutText || blog.profile.shortDescription || "Ainda não há descrição.";
  const contactEmail = blog.settings?.contactEmail;
  const socialLinks = blog.settings?.socialLinks ?? [];
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4010/api";
  let assetOrigin: string;
  try {
    const parsed = new URL(apiBase);
    assetOrigin = parsed.origin;
  } catch {
    assetOrigin = "http://localhost:4010";
  }

  const sanitizedContent = rewriteStorageAssetUrls(sanitizeRichHtml(post.contentFinal ?? post.contentRaw ?? ""), assetOrigin);
  const formattedDate = post.publishedAt ? formatDateBR(post.publishedAt) : "Data pendente";
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const normalizedMonth = String(month).padStart(2, "0");
  const postUrl = `${baseUrl}/blog/${slug}/posts/${year}/${normalizedMonth}/${postSlug}`;
  const engagement = await getPostEngagement(numericYear, numericMonth, postSlug);

  return (
    <div
      style={
        {
          "--blog-bg": theme.background,
          "--blog-text": theme.text,
          "--blog-accent": theme.accent,
          "--blog-primary": theme.primary,
          "--blog-secondary": theme.secondary,
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
          backgroundColor: theme.background,
          color: theme.text,
        } as CSSProperties
      }
      className="min-h-screen bg-[var(--blog-bg)] text-[var(--blog-text)]"
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <AuthorBlogHeader
          blogName={blog.settings?.blogName ?? blog.profile.displayName ?? "Autor sem nome"}
          blogTagline={blog.settings?.blogTagline}
          theme={theme}
          slug={slug}
          aboutText={aboutText}
          contactEmail={contactEmail}
          socialLinks={socialLinks}
          postsHref={`/blog/${slug}`}
        />

        <article className="mt-10 space-y-4 rounded-3xl border px-6 py-6" style={{ borderColor: `${theme.primary}22`, backgroundColor: `${theme.primary}11` }}>
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.4em]" style={{ color: theme.secondary }}>
              Post publicado
            </p>
            <h1 className="text-4xl font-bold" style={{ color: theme.primary }}>
              {post.title}
            </h1>
            <p className="text-sm" style={{ color: `${theme.text}CC` }}>
              {formattedDate}
              {post.readingTimeMin ? (
                <span> · {post.readingTimeMin} min de leitura</span>
              ) : null}
            </p>
          </header>
          <HtmlContentWithCopy
            html={sanitizedContent}
            className="space-y-2 text-sm leading-relaxed [&_h2]:mt-8 [&_h2]:text-3xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-2xl [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-[var(--post-code-block-border)] [&_pre]:bg-[var(--post-code-block-bg)] [&_pre]:p-4 [&_pre]:text-sm [&_pre]:text-[var(--post-code-text)] [&_pre]:shadow-[0_10px_28px_-16px_rgba(0,0,0,0.7)] [&_code]:rounded-md [&_code]:border [&_code]:border-[var(--post-code-inline-border)] [&_code]:bg-[var(--post-code-inline-bg)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.92em] [&_code]:text-[var(--post-code-text)] [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-2xl [&_table]:border [&_table]:border-[var(--post-table-border)] [&_th]:border [&_th]:border-[var(--post-table-border)] [&_th]:bg-[var(--post-table-header-bg)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-[var(--post-table-text)] [&_td]:border [&_td]:border-[var(--post-table-border)] [&_td]:bg-[var(--post-table-cell-bg)] [&_td]:px-3 [&_td]:py-2 [&_td]:text-[var(--post-table-text)]"
            style={{ color: `${theme.text}DD` }}
          />
        </article>

        <section
          className="mt-6 rounded-3xl border px-6 py-5 text-sm"
          style={{ borderColor: `${theme.secondary}33`, backgroundColor: `${theme.secondary}11`, color: `${theme.text}CC` }}
        >
          <div className="space-y-4">
            {contactEmail ? (
              <p>
                Quer conversar? Envie um e-mail para{" "}
                <a href={`mailto:${contactEmail}`} className="font-semibold hover:underline" style={{ color: theme.secondary }}>
                  {contactEmail}
                </a>
                .
              </p>
            ) : (
              <p>Autor não divulgou contato direto.</p>
            )}

            <PostEngagementPanel
              title={post.title}
              url={postUrl}
              accentColor={theme.secondary}
              textColor={theme.text}
              year={numericYear}
              month={numericMonth}
              postSlug={postSlug}
              initialEngagement={engagement}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
