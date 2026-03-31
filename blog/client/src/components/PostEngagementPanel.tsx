"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createPostComment,
  getPostEngagement,
  listPostComments,
  togglePostLike,
  type PublicComment,
  type PublicPostEngagement,
} from "@/lib/publicApi";

type Props = {
  title: string;
  url: string;
  accentColor: string;
  textColor: string;
  year: number;
  month: number;
  postSlug: string;
  initialEngagement?: PublicPostEngagement | null;
};

const COMMENT_LIMIT = 5;

function createEmptyEngagement(limit = COMMENT_LIMIT): PublicPostEngagement {
  return {
    postId: 0,
    likes: 0,
    viewerHasLiked: false,
    comments: {
      total: 0,
      page: 1,
      limit,
      items: [],
    },
  };
}

function formatCommentDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function generateVisitorId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `bb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function PostEngagementPanel({
  title,
  url,
  accentColor,
  textColor,
  year,
  month,
  postSlug,
  initialEngagement,
}: Props) {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [engagement, setEngagement] = useState<PublicPostEngagement>(initialEngagement ?? createEmptyEngagement());
  const [copied, setCopied] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentForm, setCommentForm] = useState({ name: "", email: "", content: "" });
  const [commentStatus, setCommentStatus] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  useEffect(() => {
    if (initialEngagement) {
      setEngagement(initialEngagement);
    }
  }, [initialEngagement]);

  const ensureVisitorId = useCallback(() => {
    if (visitorId) {
      return visitorId;
    }
    if (typeof window === "undefined") {
      return null;
    }
    const stored = window.localStorage.getItem("bb_visitor_id");
    if (stored) {
      setVisitorId(stored);
      return stored;
    }
    const generated = generateVisitorId();
    window.localStorage.setItem("bb_visitor_id", generated);
    setVisitorId(generated);
    return generated;
  }, [visitorId]);

  useEffect(() => {
    ensureVisitorId();
  }, [ensureVisitorId]);

  useEffect(() => {
    if (!visitorId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getPostEngagement(year, month, postSlug, { visitorId, limit: COMMENT_LIMIT });
        if (!cancelled) {
          setEngagement(data);
        }
      } catch (error) {
        console.error("[engagement] falha ao atualizar", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visitorId, year, month, postSlug]);

  const shareTargets = useMemo(
    () => [
      {
        label: "WhatsApp",
        href: `https://wa.me/?text=${encodeURIComponent(`${title} - ${url}`)}`,
      },
      {
        label: "Telegram",
        href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      },
      {
        label: "LinkedIn",
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      },
      {
        label: "X / Twitter",
        href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title} ${url}`)}`,
      },
    ],
    [title, url],
  );

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  }, [url]);

  const handleToggleLike = useCallback(async () => {
    const currentVisitorId = ensureVisitorId();
    if (!currentVisitorId) return;
    setLikePending(true);
    try {
      const action = engagement.viewerHasLiked ? "unlike" : "like";
      const result = await togglePostLike(year, month, postSlug, { action, visitorId: currentVisitorId });
      setEngagement((previous) => ({
        ...previous,
        likes: result.likes,
        viewerHasLiked: result.viewerHasLiked,
      }));
    } catch (error) {
      console.error("[engagement] falha ao registrar like", error);
    } finally {
      setLikePending(false);
    }
  }, [ensureVisitorId, engagement.viewerHasLiked, year, month, postSlug]);

  const loadMoreComments = useCallback(async () => {
    if (commentsLoading) return;
    const { comments } = engagement;
    if (comments.items.length >= comments.total) return;
    setCommentsLoading(true);
    try {
      const nextPage = comments.page + 1;
      const nextBatch = await listPostComments(year, month, postSlug, {
        page: nextPage,
        limit: comments.limit,
      });
      setEngagement((previous) => ({
        ...previous,
        comments: {
          ...nextBatch,
          items: [...previous.comments.items, ...nextBatch.items],
        },
      }));
    } catch (error) {
      console.error("[comments] falha ao carregar mais", error);
    } finally {
      setCommentsLoading(false);
    }
  }, [commentsLoading, engagement, year, month, postSlug]);

  const handleSubmitComment = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setCommentError(null);
      setCommentStatus(null);
      setCommentSubmitting(true);
      try {
        await createPostComment(year, month, postSlug, {
          authorName: commentForm.name || undefined,
          authorEmail: commentForm.email || undefined,
          content: commentForm.content,
        });
        setCommentStatus("Comentário enviado! Ele aparecerá aqui assim que for aprovado.");
        setCommentForm({ name: "", email: "", content: "" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao enviar comentário.";
        setCommentError(message);
      } finally {
        setCommentSubmitting(false);
      }
    },
    [commentForm, year, month, postSlug],
  );

  const comments = engagement.comments;
  const hasMoreComments = comments.items.length < comments.total;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleToggleLike}
          className="rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition disabled:opacity-50"
          disabled={likePending}
          style={{
            borderColor: engagement.viewerHasLiked ? accentColor : `${textColor}33`,
            color: engagement.viewerHasLiked ? accentColor : textColor,
            backgroundColor: engagement.viewerHasLiked ? `${accentColor}15` : "transparent",
          }}
        >
          {engagement.viewerHasLiked ? "Você curtiu" : "Curtir"} • {engagement.likes}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition"
          style={{
            borderColor: copied ? accentColor : `${textColor}33`,
            color: copied ? accentColor : textColor,
            backgroundColor: copied ? `${accentColor}15` : "transparent",
          }}
        >
          {copied ? "Link copiado!" : "Copiar link"}
        </button>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.4em]" style={{ color: `${textColor}80` }}>
          Compartilhar
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {shareTargets.map((target) => (
            <a
              key={target.label}
              href={target.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] transition"
              style={{ borderColor: `${textColor}33`, color: textColor }}
            >
              {target.label}
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-dashed px-4 py-4" style={{ borderColor: `${textColor}33`, color: `${textColor}CC` }}>
        <p className="text-xs uppercase tracking-[0.4em]" style={{ color: accentColor }}>
          Comentários ({comments.total})
        </p>

        {comments.items.length ? (
          <ul className="mt-3 space-y-3 text-sm">
            {comments.items.map((comment: PublicComment) => (
              <li key={comment.id} className="rounded-xl border px-3 py-2" style={{ borderColor: `${textColor}22` }}>
                <div className="flex flex-wrap items-baseline gap-2 text-[0.7rem]" style={{ color: `${textColor}90` }}>
                  <span className="font-semibold">{comment.authorName ?? "Leitor"}</span>
                  <span>{formatCommentDate(comment.createdAt)}</span>
                </div>
                <p className="mt-1 text-[0.85rem]" style={{ color: `${textColor}CC` }}>
                  {comment.content}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm" style={{ color: `${textColor}AA` }}>
            Ainda não há comentários aprovados. Seja o primeiro a participar!
          </p>
        )}

        {hasMoreComments ? (
          <button
            type="button"
            onClick={loadMoreComments}
            className="mt-3 text-xs font-semibold uppercase tracking-[0.3em] underline decoration-dotted disabled:opacity-50"
            disabled={commentsLoading}
            style={{ color: accentColor }}
          >
            {commentsLoading ? "Carregando..." : "Ver mais"}
          </button>
        ) : null}

        <form className="mt-4 space-y-3 text-sm" onSubmit={handleSubmitComment}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              name="name"
              placeholder="Seu nome (opcional)"
              value={commentForm.name}
              onChange={(event) => setCommentForm((prev) => ({ ...prev, name: event.target.value }))}
              className="rounded-xl border bg-transparent px-3 py-2 text-sm outline-none transition focus:ring-2"
              style={{ borderColor: `${textColor}33`, color: textColor, boxShadow: "none" }}
            />
            <input
              type="email"
              name="email"
              placeholder="E-mail (opcional, não será publicado)"
              value={commentForm.email}
              onChange={(event) => setCommentForm((prev) => ({ ...prev, email: event.target.value }))}
              className="rounded-xl border bg-transparent px-3 py-2 text-sm outline-none transition focus:ring-2"
              style={{ borderColor: `${textColor}33`, color: textColor, boxShadow: "none" }}
            />
          </div>
          <textarea
            name="content"
            placeholder="O que achou do post?"
            value={commentForm.content}
            onChange={(event) => setCommentForm((prev) => ({ ...prev, content: event.target.value }))}
            rows={4}
            required
            className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none transition focus:ring-2"
            style={{ borderColor: `${textColor}33`, color: textColor, boxShadow: "none" }}
          />
          <button
            type="submit"
            className="rounded-xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition disabled:opacity-50"
            style={{ borderColor: accentColor, color: accentColor }}
            disabled={commentSubmitting || commentForm.content.trim().length < 3}
          >
            {commentSubmitting ? "Enviando..." : "Enviar comentário"}
          </button>
          {commentStatus ? (
            <p className="text-xs" style={{ color: accentColor }}>
              {commentStatus}
            </p>
          ) : null}
          {commentError ? (
            <p className="text-xs" style={{ color: "#f87171" }}>
              {commentError}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
