"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDateTimeBR } from "@/lib/dateTime";
import type { Post } from "@/types";

type PostsResponse = {
  data: Post[];
};

const statusLabels: Record<Post["status"], string> = {
  draft: "Rascunho",
  published: "Publicado",
};

export default function PostsAdminPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response: PostsResponse = await api.posts();
      setPosts(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os posts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleCreatePost = async () => {
    try {
      setCreating(true);
      const newPost = await api.createPost({
        title: "Novo post",
        contentRaw: "",
        status: "draft",
      });
      router.push(`/admin/posts/${newPost.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar o post.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-10">
      <header className="rounded-3xl border border-slate-900 bg-slate-900/50 p-6">
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Posts & editor</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Crie, edite e refine com a IA</h1>
        <p className="mt-2 text-sm text-slate-300">
          Use o editor Tiptap para escrever, aplique revisões geradas com a IA e publique quando estiver pronto.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={handleCreatePost}
            disabled={creating}
            className="rounded-2xl bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-400/30 transition hover:bg-emerald-300 disabled:opacity-50"
          >
            {creating ? "Criando..." : "Novo post com IA"}
          </button>
          <button
            onClick={fetchPosts}
            className="rounded-2xl border border-slate-800 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-300"
          >
            Atualizar lista
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </header>

      <section className="rounded-3xl border border-slate-900 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Seus posts</h2>
          <span className="text-sm text-slate-500">{posts.length} itens</span>
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="h-16 animate-pulse rounded-2xl bg-slate-800/40" />
            ))}
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-800">
            {posts.map((post) => (
              <li key={post.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <Link href={`/admin/posts/${post.id}`} className="text-lg font-semibold text-white hover:text-emerald-300">
                      {post.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {post.updatedAt ? formatDateTimeBR(post.updatedAt) : "Sem data"}
                    </p>
                    <p className="text-sm text-slate-300">{post.excerpt ?? "Sem resumo ainda."}</p>
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <span
                      className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.3em] ${
                        post.status === "published"
                          ? "bg-emerald-400/20 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {statusLabels[post.status]}
                    </span>
                    <Link
                      href={`/admin/posts/${post.id}`}
                      className="rounded-2xl border border-slate-800 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 hover:border-emerald-400"
                    >
                      Abrir editor
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
