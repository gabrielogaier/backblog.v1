"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDateTimeBR } from "@/lib/dateTime";
import type { ModerationComment, UserProfile } from "@/types";

const STATUS_OPTIONS: Array<{ value: "pending" | "approved" | "hidden"; label: string }> = [
  { value: "pending", label: "Pendentes" },
  { value: "approved", label: "Aprovados" },
  { value: "hidden", label: "Ocultos" },
];

const statusChipClass: Record<ModerationComment["status"], string> = {
  pending: "bg-amber-400/10 text-amber-200",
  approved: "bg-emerald-400/10 text-emerald-200",
  hidden: "bg-rose-400/10 text-rose-200",
};

const statusLabel: Record<ModerationComment["status"], string> = {
  pending: "Pendente",
  approved: "Aprovado",
  hidden: "Oculto",
};

const PAGE_LIMIT = 10;

type CommentsResponse = {
  data: ModerationComment[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

function formatDate(value?: string | null) {
  return formatDateTimeBR(value);
}

export default function CommentsModerationPage() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "hidden">("pending");
  const [comments, setComments] = useState<ModerationComment[]>([]);
  const [meta, setMeta] = useState<CommentsResponse["meta"]>({ page: 1, limit: PAGE_LIMIT, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [blogSlug, setBlogSlug] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getProfile()
      .then((profile: UserProfile) => {
        if (active) {
          setBlogSlug(profile.slug ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setBlogSlug(null);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handle);
  }, [search]);

  const canLoadMore = useMemo(() => comments.length < meta.total, [comments.length, meta.total]);

  const fetchComments = async ({ page = 1, append = false }: { page?: number; append?: boolean }) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const response = await api.listComments({
        status: statusFilter,
        page,
        limit: PAGE_LIMIT,
        search: debouncedSearch || undefined,
      });
      setComments((prev) => (append ? [...prev, ...response.data] : response.data));
      setMeta(response.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os comentários.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchComments({ page: 1, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, debouncedSearch]);

  const handleUpdateStatus = async (commentId: number, status: ModerationComment["status"]) => {
    try {
      await api.updateCommentStatus(commentId, status);
      setComments((prev) => prev.map((item) => (item.id === commentId ? { ...item, status } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar o comentário.");
    }
  };

  const handleLoadMore = () => {
    if (!canLoadMore || loadingMore) return;
    fetchComments({ page: meta.page + 1, append: true });
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-16">
      <header className="rounded-3xl border border-slate-900 bg-slate-900/60 p-6">
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Moderar comentários</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Acompanhe o que o público está dizendo</h1>
        <p className="mt-2 text-sm text-slate-300">
          Aprove ou oculte comentários enviados para seus posts públicos. Filtros ajudam a focar nos pendentes e manter o histórico organizado.
        </p>
      </header>

      <section className="rounded-3xl border border-slate-900 bg-slate-900/60 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] transition ${
                  statusFilter === option.value ? "bg-emerald-400/20 text-emerald-200" : "border border-slate-800 text-slate-300"
                }`}
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            placeholder="Buscar por conteúdo, autor ou post"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400 md:w-72"
          />
        </div>

        {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

        {loading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`loading-${index}`} className="h-24 animate-pulse rounded-2xl bg-slate-800/40" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="mt-6 text-sm text-slate-400">Nenhum comentário para este filtro ainda.</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {comments.map((comment) => {
              const permalink =
                blogSlug && comment.postSlug && comment.postYear && comment.postMonth
                  ? `/blog/${blogSlug}/posts/${comment.postYear}/${String(comment.postMonth).padStart(2, "0")}/${comment.postSlug}`
                  : null;
              return (
                <li key={comment.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{comment.authorName || "Leitor"}</p>
                      <p className="text-sm text-slate-400">{formatDate(comment.createdAt)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusChipClass[comment.status]}`}>
                      {statusLabel[comment.status]}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-200">{comment.content}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="font-semibold text-white">Post:</span>
                    <span>{comment.postTitle}</span>
                    {permalink && (
                      <Link
                        href={permalink}
                        target="_blank"
                        className="rounded-full border border-slate-800 px-3 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-slate-300 hover:border-emerald-400"
                      >
                        Ver post
                      </Link>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {comment.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(comment.id, "approved")}
                        className="rounded-2xl border border-emerald-400 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200"
                      >
                        Aprovar
                      </button>
                    )}
                    {comment.status !== "hidden" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(comment.id, "hidden")}
                        className="rounded-2xl border border-rose-400 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-rose-200"
                      >
                        Ocultar
                      </button>
                    )}
                    {comment.status !== "pending" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(comment.id, "pending")}
                        className="rounded-2xl border border-amber-400 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200"
                      >
                        Voltar para pendente
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {canLoadMore && !loading && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="rounded-full border border-slate-800 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 hover:border-emerald-400 disabled:opacity-50"
            >
              {loadingMore ? "Carregando..." : "Carregar mais"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
