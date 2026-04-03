import { Metadata } from "next";
import Link from "next/link";
import { listPublishedPosts, getBlogSettings } from "@/lib/publicApi";
import { formatDateBR } from "@/lib/dateTime";
import { notFound } from "next/navigation";

const MONTH_LABELS = [
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

export const revalidate = 60;

type PostsMonthlyParams = { year: string; month: string };

export async function generateMetadata({ params }: { params: Promise<PostsMonthlyParams> }): Promise<Metadata> {
  const resolvedParams = await params;
  const monthIndex = Number(resolvedParams.month) - 1;
  const monthName = MONTH_LABELS[monthIndex] ?? "mês";
  const settings = await getBlogSettings();

  return {
    title: `${monthName} ${resolvedParams.year} | ${settings?.blogName ?? "Backblog"}`,
    description: `Arquivo do mês de ${monthName} no ${settings?.blogName ?? "Backblog"}.`,
  };
}

export default async function PostsMonthlyArchivePage({ params }: { params: Promise<PostsMonthlyParams> }) {
  const { year: yearParam, month: monthParam } = await params;
  const year = Number(yearParam);
  const month = Number(monthParam);
  const posts = await listPublishedPosts({ year, month, limit: 100 });

  if (!posts.data.length) {
    notFound();
  }

  const monthName = MONTH_LABELS[month - 1] ?? `${month}`;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-8 lg:px-16">
      <main className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl border border-slate-900 bg-slate-900/70 p-8">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Arquivo mensal</p>
          <h1 className="mt-2 text-4xl font-semibold text-white">{`${monthName} de ${year}`}</h1>
          <p className="text-sm text-slate-400">
            {posts.data.length} publicação{posts.data.length > 1 ? "es" : ""} nesse mês.
          </p>
        </header>

        <section className="space-y-4">
          {posts.data.map((post) => {
            const permalink = post.authorSlug
              ? `/blog/${post.authorSlug}/posts/${yearParam}/${monthParam}/${post.slug}`
              : `/posts/${yearParam}/${monthParam}/${post.slug}`;
            return (
              <article key={post.id} className="rounded-3xl border border-slate-900 bg-slate-900/60 p-6 transition hover:border-emerald-400">
                <Link
                  href={permalink}
                  className="text-2xl font-semibold text-white hover:text-emerald-300"
                >
                  {post.title}
                </Link>
                <p className="mt-2 text-sm text-slate-400">
                  {post.publishedAt ? formatDateBR(post.publishedAt) : "Data pendente"}
                </p>
                <p className="mt-3 text-sm text-slate-300">{post.excerpt ?? "Nenhuma descrição ainda."}</p>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
