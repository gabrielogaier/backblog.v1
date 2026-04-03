import type { Metadata } from "next";
import Link from "next/link";
import { formatDateBR, formatMonthNameBR } from "@/lib/dateTime";
import { getBlogSettings, listPublishedPosts } from "@/lib/publicApi";

const normalizeParam = (value?: string | string[] | null) => (Array.isArray(value) ? value[0] : value);

export const revalidate = 60;

type PostsArchiveSearchParams = {
  search?: string | string[];
  tag?: string | string[];
  year?: string | string[];
  month?: string | string[];
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<PostsArchiveSearchParams>;
}): Promise<Metadata> {
  const settings = await getBlogSettings();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = normalizeParam(resolvedSearchParams?.search);
  const label = query ? `Busca por "${query}"` : "Arquivo público";

  return {
    title: `${settings?.blogName ?? "Backblog"} | ${label}`,
    description:
      settings?.seoDescription ??
      "Arquivo público do Backblog: posts publicados com IA e revisões controladas.",
    openGraph: {
      title: `${settings?.blogName ?? "Backblog"} | ${label}`,
      description: settings?.seoDescription ?? undefined,
    },
    alternates: {
      canonical: "/posts",
      types: {
        "application/rss+xml": "/rss.xml",
      },
    },
  };
}

export default async function PostsArchivePage({ searchParams }: { searchParams?: Promise<PostsArchiveSearchParams> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const search = normalizeParam(resolvedSearchParams?.search);
  const tag = normalizeParam(resolvedSearchParams?.tag);
  const year = Number(normalizeParam(resolvedSearchParams?.year));
  const month = Number(normalizeParam(resolvedSearchParams?.month));

  const [settings, postsResponse] = await Promise.all([
    getBlogSettings(),
    listPublishedPosts({
      limit: 12,
      year: Number.isFinite(year) ? year : undefined,
      month: Number.isFinite(month) ? month : undefined,
      tag: tag || undefined,
      search: search || undefined,
    }),
  ]);

  const years = Array.from(
    new Set(postsResponse.data.map((post) => post.year).filter((value) => typeof value === "number")),
  ).sort((a, b) => Number(b) - Number(a));
  const months = Array.from(
    new Set(postsResponse.data.map((post) => post.month).filter((value) => typeof value === "number")),
  ).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-8 lg:px-16">
      <main className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-6 rounded-3xl border border-slate-900 bg-slate-900/70 p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Arquivo público</p>
            <h1 className="mt-2 text-4xl font-semibold text-white sm:text-5xl">
              {settings?.blogName ?? "Backblog"} — Posts públicos
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              {settings?.blogTagline ??
                "Explore posts com IA, reverta refinamentos e confira o histórico completo de cada publicação."}
            </p>
          </div>

          <form className="grid gap-3 rounded-3xl border border-slate-900 bg-slate-950/70 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" method="get">
            <label className="flex flex-col text-xs uppercase tracking-[0.4em] text-slate-500">
              Busca
              <input
                name="search"
                defaultValue={search ?? ""}
                placeholder="Buscar por título, conteúdo ou marca..."
                className="mt-1 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
              />
            </label>

            <label className="flex flex-col text-xs uppercase tracking-[0.4em] text-slate-500">
              Tag
              <input
                name="tag"
                defaultValue={tag ?? ""}
                placeholder="Ex.: produtividade"
                className="mt-1 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
              />
            </label>

            <div className="flex items-end gap-2">
              <select
                name="year"
                defaultValue={Number.isFinite(year) ? year : ""}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
              >
                <option value="">Ano</option>
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select
                name="month"
                defaultValue={Number.isFinite(month) ? month : ""}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
              >
                <option value="">Mês</option>
                {months
                  .sort((a, b) => Number(b) - Number(a))
                  .map((value) => (
                    <option key={value} value={value}>
                      {`${String(value).padStart(2, "0")} — ${formatMonthNameBR(Number(value))}`}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-3 md:col-span-3">
              <button
                type="submit"
                className="mt-3 h-12 rounded-2xl bg-emerald-400 px-6 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 hover:bg-emerald-300"
              >
                Filtrar
              </button>
              <Link
                href="/posts"
                className="mt-3 rounded-2xl border border-slate-800 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 hover:border-emerald-400"
              >
                Limpar filtros
              </Link>
              <a
                href="/rss.xml"
                className="mt-3 rounded-2xl border border-emerald-500/60 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300 hover:bg-emerald-500/10"
              >
                RSS
              </a>
            </div>
          </form>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {postsResponse.data.map((post) => {
            const permalink = post.authorSlug
              ? `/blog/${post.authorSlug}/posts/${post.year}/${String(post.month).padStart(2, "0")}/${post.slug}`
              : `/posts/${post.year}/${String(post.month).padStart(2, "0")}/${post.slug}`;
            return (
              <article
                key={post.id}
                className="flex flex-col gap-3 rounded-3xl border border-slate-900 bg-slate-900/70 p-6 transition hover:border-emerald-400"
              >
                <Link
                  href={permalink}
                  className="text-xl font-semibold text-white hover:text-emerald-300"
                >
                  {post.title}
                </Link>
                <p className="text-sm text-slate-400">
                  {post.publishedAt ? formatDateBR(post.publishedAt) : "Data pendente"}
                </p>
                <p className="text-sm text-slate-300">{post.excerpt ?? "Rascunho com o mesmo tom refinado pela IA."}</p>
                <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                  {post.tags.map((tagItem) => (
                    <span key={tagItem.id} className="rounded-full border border-slate-800 px-3 py-1">
                      #{tagItem.slug}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
