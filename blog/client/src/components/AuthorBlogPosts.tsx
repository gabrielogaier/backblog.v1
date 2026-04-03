"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDateBR } from "@/lib/dateTime";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  contentFinal?: string | null;
  contentRaw?: string | null;
  status: "draft" | "published";
  readingTimeMin?: number | null;
  publishedAt?: string | null;
  year?: number | null;
  month?: number | null;
  day?: number | null;
  tags: Array<{ id: number; name: string; slug: string }>;
};

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type Group = {
  label: string;
  year: number;
  month: number;
  posts: Post[];
};

type Props = {
  posts: Post[];
  slug: string;
  theme: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
  };
};

const MAX_PREVIEW_LENGTH = 200;

function normalizePreviewText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/<\/?[^>]+(>|$)/g, " ")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(^|\s)[*-]\s+/gm, " ")
    .replace(/(^|\s)\d+\.\s+/gm, " ")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const slice = value.slice(0, maxLength);
  const safeBreak = slice.lastIndexOf(" ");
  const trimmed = safeBreak > maxLength * 0.6 ? slice.slice(0, safeBreak) : slice;
  return `${trimmed.trimEnd()}...`;
}

function buildPostPreview(post: Post) {
  const source = post.excerpt?.trim() || post.contentFinal?.trim() || post.contentRaw?.trim() || "";
  if (!source) {
    return "Prévia ainda não definida para este post.";
  }
  return truncateText(normalizePreviewText(source), MAX_PREVIEW_LENGTH);
}

function groupPosts(posts: Post[]): Group[] {
  const groups = new Map<string, Group>();
  posts.forEach((post) => {
    if (!post.year || !post.month) return;
    const key = `${post.year}-${String(post.month).padStart(2, "0")}`;
    const label = `${MONTHS[Number(post.month) - 1] ?? post.month} · ${post.year}`;
    if (!groups.has(key)) {
      groups.set(key, { label, year: Number(post.year), month: Number(post.month), posts: [] });
    }
    groups.get(key)!.posts.push(post);
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (a.year === b.year) {
      return b.month - a.month;
    }
    return b.year - a.year;
  });
}

export function AuthorBlogPosts({ posts, slug, theme }: Props) {
  const [query, setQuery] = useState("");
  const previewByPostId = useMemo(
    () => new Map(posts.map((post) => [post.id, buildPostPreview(post)])),
    [posts],
  );

  const filteredPosts = useMemo(() => {
    if (!query.trim()) return posts;
    const normalized = query.trim().toLowerCase();
    return posts.filter((post) => {
      const title = post.title.toLowerCase();
      const preview = (previewByPostId.get(post.id) ?? "").toLowerCase();
      const tags = post.tags.map((tag) => `${tag.name} ${tag.slug}`).join(" ").toLowerCase();
      return title.includes(normalized) || preview.includes(normalized) || tags.includes(normalized);
    });
  }, [posts, query, previewByPostId]);

  const grouped = useMemo(() => groupPosts(filteredPosts), [filteredPosts]);

  return (
    <section id="posts" className="space-y-6 scroll-mt-32">
      <div className="flex flex-col gap-2 rounded-3xl border px-4 py-4" style={{ borderColor: `${theme.text}33` }}>
        <label className="text-xs uppercase tracking-[0.4em] text-[var(--blog-secondary)]" htmlFor="blog-search">
          Buscar posts
        </label>
        <input
          id="blog-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Título, prévia ou tag..."
          className="rounded-full border px-3 py-2 text-sm outline-none"
          style={{ borderColor: `${theme.text}22`, color: theme.text, backgroundColor: theme.background }}
        />
        <p className="text-xs text-[var(--blog-text)]/60">
          Mostrando {filteredPosts.length} de {posts.length} publicação{posts.length === 1 ? "" : "ões"}.
        </p>
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-2xl border px-5 py-4 text-sm" style={{ borderColor: `${theme.primary}22`, backgroundColor: `${theme.primary}11` }}>
          Nenhum post corresponde ao filtro atual.
        </p>
      ) : (
        grouped.map((group) => (
          <div key={group.label} className="space-y-4 rounded-3xl border px-6 py-5" style={{ borderColor: `${theme.primary}22` }}>
            <h3 className="text-lg font-semibold" style={{ color: theme.primary }}>
              {group.label}
            </h3>
            <div className="space-y-3">
              {group.posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border px-4 py-4 shadow-sm"
                  style={{ borderColor: `${theme.secondary}33`, backgroundColor: `${theme.secondary}11` }}
                >
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <Link
                      href={`/blog/${slug}/posts/${post.year}/${String(post.month).padStart(2, "0")}/${post.slug}`}
                      className="text-xl font-semibold"
                      style={{ color: theme.text }}
                    >
                      {post.title}
                    </Link>
                    <span className="text-xs" style={{ color: `${theme.text}70` }}>
                      {post.publishedAt ? formatDateBR(post.publishedAt) : "Data em breve"}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-sm" style={{ color: `${theme.text}CC` }}>
                    {previewByPostId.get(post.id)}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs uppercase tracking-[0.2em]" style={{ color: theme.secondary }}>
                    <Link
                      href={`/blog/${slug}/posts/${post.year}/${String(post.month).padStart(2, "0")}/${post.slug}`}
                      className="font-semibold"
                    >
                      Ler post
                    </Link>
                    {post.readingTimeMin ? <span style={{ color: `${theme.text}80` }}>· {post.readingTimeMin} min</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
