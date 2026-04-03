"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDateTimeBR } from "@/lib/dateTime";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useAuth } from "@/contexts/AuthContext";
import markdownProfile from "@/config/markdownProfile.json";
import type { AiUsage, Conversation, ConversationMessage, Post } from "@/types";

type PostResponse = Post;
type ConversationsResponse = { data: Conversation[] };
type MessagesResponse = { data: ConversationMessage[] };

const toExcerpt = (html: string) => {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280);
};

const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const CODE_FENCE = markdownProfile.codeBlock?.fence || "```";
const TABLES_ENABLED = Boolean(markdownProfile.tables?.enabled);

const configuredHeadingLevels = (markdownProfile.headings?.allowedLevels ?? [2, 3]).filter(
  (level): level is number => Number.isInteger(level) && level >= 1 && level <= 6,
);
const headingLevels = configuredHeadingLevels.length ? configuredHeadingLevels : [2, 3];
const minHeadingLevel = Math.min(...headingLevels);
const maxHeadingLevel = Math.max(...headingLevels);

const escapeRegexCharClass = (value: string) => value.replace(/[\\^$.*+?()[\]{}|-]/g, "\\$&");
const configuredUnorderedMarkers = (markdownProfile.lists?.unorderedMarkers ?? ["-", "*"]).filter(
  (marker): marker is string => typeof marker === "string" && marker.length > 0,
);
const unorderedMarkers = configuredUnorderedMarkers.length ? configuredUnorderedMarkers : ["-", "*"];
const unorderedMarkerRegex = new RegExp(`^[${unorderedMarkers.map(escapeRegexCharClass).join("")}]\\s+(.+)$`);
const tableSeparatorCellRegex = /^:?-{3,}:?$/;

const splitPipeRow = (line: string): string[] | null => {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return null;

  const withoutLeading = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutEdges = withoutLeading.endsWith("|") ? withoutLeading.slice(0, -1) : withoutLeading;
  const cells = withoutEdges.split("|").map((cell) => cell.trim());
  if (cells.length < 2) return null;
  return cells;
};

const isPipeSeparatorLine = (line: string, expectedCells: number) => {
  const cells = splitPipeRow(line);
  return Boolean(cells && cells.length === expectedCells && cells.every((cell) => tableSeparatorCellRegex.test(cell)));
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderInlineMarkdown = (value: string) => {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
};

const renderTableHtml = (headerCells: string[], bodyRows: string[][]) => {
  const head = `<thead><tr>${headerCells.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead>`;
  const body = bodyRows.length
    ? `<tbody>${bodyRows
        .map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody>`
    : "";
  return `<table>${head}${body}</table>`;
};

const markdownToHtml = (value: string) => {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const lines = normalized.split("\n");
  const chunks: string[] = [];
  const paragraphBuffer: string[] = [];
  const codeBlockBuffer: string[] = [];
  let listMode: "ul" | "ol" | null = null;
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const paragraph = paragraphBuffer.join(" ");
    chunks.push(`<p>${renderInlineMarkdown(paragraph)}</p>`);
    paragraphBuffer.length = 0;
  };

  const closeList = () => {
    if (!listMode) return;
    chunks.push(`</${listMode}>`);
    listMode = null;
  };

  let index = 0;
  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (line.startsWith(CODE_FENCE)) {
      flushParagraph();
      closeList();

      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockBuffer.length = 0;
      } else {
        chunks.push(`<pre><code>${escapeHtml(codeBlockBuffer.join("\n"))}</code></pre>`);
        inCodeBlock = false;
        codeBlockBuffer.length = 0;
      }
      index += 1;
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(rawLine);
      index += 1;
      continue;
    }

    if (!line) {
      flushParagraph();
      closeList();
      index += 1;
      continue;
    }

    if (TABLES_ENABLED) {
      const headerCells = splitPipeRow(rawLine);
      const nextLine = index + 1 < lines.length ? lines[index + 1] : "";
      if (headerCells && nextLine && isPipeSeparatorLine(nextLine, headerCells.length)) {
        flushParagraph();
        closeList();

        const bodyRows: string[][] = [];
        let cursor = index + 2;
        while (cursor < lines.length) {
          const rowLine = lines[cursor];
          const rowTrimmed = rowLine.trim();
          if (!rowTrimmed) {
            break;
          }

          const rowCells = splitPipeRow(rowLine);
          if (!rowCells || rowCells.length !== headerCells.length) {
            break;
          }
          bodyRows.push(rowCells);
          cursor += 1;
        }

        chunks.push(renderTableHtml(headerCells, bodyRows));
        index = cursor;
        continue;
      }
    }

    const headingMatch = line.match(/^(#{1,6})\s*(.+)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = Math.min(maxHeadingLevel, Math.max(minHeadingLevel, headingMatch[1].length));
      chunks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    const quoteMatch = line.match(/^>\s*(.+)$/);
    if (quoteMatch) {
      flushParagraph();
      closeList();
      chunks.push(`<blockquote>${renderInlineMarkdown(quoteMatch[1])}</blockquote>`);
      index += 1;
      continue;
    }

    const unorderedMatch = line.match(unorderedMarkerRegex);
    if (unorderedMatch) {
      flushParagraph();
      if (listMode !== "ul") {
        closeList();
        chunks.push("<ul>");
        listMode = "ul";
      }
      chunks.push(`<li>${renderInlineMarkdown(unorderedMatch[1])}</li>`);
      index += 1;
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listMode !== "ol") {
        closeList();
        chunks.push("<ol>");
        listMode = "ol";
      }
      chunks.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
      index += 1;
      continue;
    }

    closeList();
    paragraphBuffer.push(line);
    index += 1;
  }

  flushParagraph();
  closeList();
  if (inCodeBlock && codeBlockBuffer.length) {
    chunks.push(`<pre><code>${escapeHtml(codeBlockBuffer.join("\n"))}</code></pre>`);
  }

  return chunks.join("\n");
};

const dedupeMessages = (items: ConversationMessage[]) => {
  const seen = new Set<string>();
  return items.filter((message) => {
    const key = `${message.id}-${message.role}-${message.createdAt}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export default function PostEditorPage() {
  const params = useParams<{ postId: string }>();
  const postId = params.postId;
  const router = useRouter();
  const { updateAiUsage } = useAuth();

  const [post, setPost] = useState<PostResponse | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  const [title, setTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [postResponse, conversationsResponse]: [PostResponse, ConversationsResponse] = await Promise.all([
          api.post(postId),
          api.conversations(postId),
        ]);

        setPost(postResponse);
        setAiUsage(postResponse.aiUsage ?? null);
        updateAiUsage(postResponse.aiUsage ?? null);
        setTitle(postResponse.title);
        setEditorContent(postResponse.contentRaw || postResponse.contentFinal || "");
        setConversations(conversationsResponse.data);

        if (conversationsResponse.data.length > 0) {
          setSelectedConversation(conversationsResponse.data[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar o post.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [postId, updateAiUsage]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedConversation) return;
      try {
        const response: MessagesResponse = await api.conversationMessages(postId, selectedConversation);
        setMessages(dedupeMessages(response.data));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível carregar as mensagens.");
      }
    };

    fetchMessages();
  }, [postId, selectedConversation]);

  const handleUploadImage = useCallback(async (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      const message = "Formato não suportado. Use JPG, PNG, WEBP ou GIF.";
      setActionMessage({ tone: "error", text: message });
      throw new Error(message);
    }
    if (file.size > IMAGE_MAX_SIZE) {
      const message = "Imagem maior que 5MB. Reduza o tamanho antes de enviar.";
      setActionMessage({ tone: "error", text: message });
      throw new Error(message);
    }

    try {
      const uploaded = await api.uploadImage(file);
      setActionMessage({ tone: "success", text: "Imagem enviada com sucesso." });
      return uploaded.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar a imagem.";
      setError(message);
      setActionMessage({ tone: "error", text: message });
      throw err;
    }
  }, []);

  const updatePost = useCallback(async (payload: Record<string, unknown>) => {
    if (!post) return null;
    const updated = await api.updatePost(String(post.id), payload);
    setPost(updated);
    return updated;
  }, [post]);

  const handleSaveDraft = async () => {
    if (!post) return;
    setSavingDraft(true);
    setError(null);
    setActionMessage(null);
    try {
      const nextStatus = post.status === "published" ? "published" : "draft";
      await updatePost({
        title,
        contentRaw: editorContent,
        excerpt: toExcerpt(editorContent),
        status: nextStatus,
      });
      setActionMessage({ tone: "success", text: "Rascunho salvo com sucesso." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o rascunho.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleDeletePost = async () => {
    if (!post || deleting) return;
    const confirmed =
      typeof window === "undefined"
        ? false
        : window.confirm("Tem certeza que deseja excluir este post? Essa ação não pode ser desfeita.");
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);
    setActionMessage(null);
    try {
      await api.deletePost(String(post.id));
      router.push("/admin/posts");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível excluir o post.";
      setError(message);
      setActionMessage({ tone: "error", text: message });
    } finally {
      setDeleting(false);
    }
  };

  const handlePublish = async () => {
    if (!post) return;
    setPublishing(true);
    setError(null);
    setActionMessage(null);
    try {
      await updatePost({
        title,
        contentRaw: editorContent,
        contentFinal: editorContent,
        excerpt: toExcerpt(editorContent),
        status: "published",
      });
      setActionMessage({ tone: "success", text: "Post publicado com sucesso." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao publicar o post.";
      setError(message);
      setActionMessage({ tone: "error", text: message });
    } finally {
      setPublishing(false);
    }
  };

  const handleCreateConversation = useCallback(async () => {
    try {
      const conversation = await api.createConversation(postId, "Nova conversa");
      setConversations((prev) => [conversation, ...prev]);
      setSelectedConversation(conversation.id);
      setMessages([]);
      return conversation;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a conversa.");
      return null;
    }
  }, [postId]);

  const handleSend = async () => {
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage) return;
    if (aiUsage && aiUsage.reachedLimit) {
      setError(
        `Limite diário da IA atingido (${aiUsage.requestCount}/${aiUsage.limit}). Tente novamente amanhã.`,
      );
      return;
    }

    setSending(true);
    setError(null);
    try {
      let conversationId = selectedConversation;
      if (!conversationId) {
        const conversation = await handleCreateConversation();
        conversationId = conversation?.id ?? null;
      }

      if (!conversationId) {
        throw new Error("Não foi possível iniciar a conversa.");
      }

      const payload: { content: string; draft?: string } = { content: trimmedMessage };
      if (editorContent.trim().length > 0) {
        payload.draft = editorContent;
      }

      const response = await api.sendConversationMessage(postId, conversationId, payload);
      setMessages((prev) => dedupeMessages([...prev, response.userMessage, response.aiMessage]));
      if (response.aiUsage) {
        setAiUsage(response.aiUsage);
        updateAiUsage(response.aiUsage);
      }
      setMessageInput("");
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId ? { ...conv, updatedAt: response.aiMessage.createdAt } : conv,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar a mensagem.");
    } finally {
      setSending(false);
    }
  };

  const handleApplyAiMessage = useCallback((content: string) => {
    if (!content) return;
    const confirmed =
      typeof window === "undefined" ? true : window.confirm("Aplicar esta resposta da IA e substituir o texto atual?");
    if (!confirmed) {
      return;
    }
    setEditorContent(markdownToHtml(content));
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversation),
    [conversations, selectedConversation],
  );
  const aiLimitReached = Boolean(aiUsage?.reachedLimit);

  if (!loading && !post) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-12">
      {loading && <p className="text-center text-slate-400">Carregando...</p>}
      {error && <p className="rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-300">{error}</p>}

      {post && (
        <>
          <header className="rounded-3xl border border-slate-900 bg-slate-900/60 p-5">
            <p className="text-xs uppercase tracking-widest text-emerald-400">editando</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold text-white">{post.title}</h1>
              <span className="rounded-full border border-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                {post.status === "published" ? "Publicado" : "Rascunho"}
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Última edição em {formatDateTimeBR(post.updatedAt)}
            </p>
            {post.contentFinal && (
              <p className="mt-2 text-xs text-slate-500">
                Versão final possui {post.contentFinal.length} caracteres.
              </p>
            )}
          </header>

          <section className="space-y-4 rounded-3xl border border-slate-900 bg-slate-900/60 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <label className="flex-1 text-sm text-slate-300">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Título do post
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-base text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
                />
              </label>
              <div className="flex shrink-0 flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={savingDraft}
                  className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 disabled:opacity-50"
                >
                  {savingDraft ? "Salvando..." : "Salvar rascunho"}
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing}
                  className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-400/30 disabled:opacity-50"
                >
                  {publishing ? "Publicando..." : "Publicar"}
                </button>
                <button
                  type="button"
                  onClick={handleDeletePost}
                  disabled={deleting}
                  className="rounded-2xl border border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-300 hover:border-rose-400 disabled:opacity-50"
                >
                  {deleting ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </div>
            {actionMessage && (
              <p
                className={`text-xs ${actionMessage.tone === "success" ? "text-emerald-300" : "text-rose-300"}`}
              >
                {actionMessage.text}
              </p>
            )}

            <RichTextEditor value={editorContent} onChange={setEditorContent} onUploadImage={handleUploadImage} />
            <p className="text-xs text-slate-500">
              Resumo atual: {editorContent ? `${toExcerpt(editorContent).length} caracteres.` : "vazio"}
            </p>
          </section>

          <section className="rounded-3xl border border-slate-900 bg-slate-900/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Conversa com IA</p>
                <p className="text-sm text-slate-300">{activeConversation ? activeConversation.title : "Nenhuma conversa ativa"}</p>
              </div>
              {aiUsage && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">limite diário</p>
                  <p className="text-sm font-semibold text-emerald-300">
                    {aiUsage.remaining} de {aiUsage.limit}
                  </p>
                </div>
              )}
              <button
                onClick={handleCreateConversation}
                className="rounded-full border border-slate-800 px-3 py-1 text-xs font-semibold text-slate-200"
              >
                Nova
              </button>
            </div>

            <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
              {messages.map((message) => {
                const isUser = message.role === "user";
                const canApply = !isUser && message.content.trim().length > 0;
                const renderedContent = markdownToHtml(message.content);
                return (
                  <div
                    key={`${message.id}-${message.createdAt}-${message.role}`}
                    className={`rounded-2xl px-4 py-3 text-sm space-y-2 ${
                      isUser ? "bg-emerald-400/10 text-emerald-50" : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-widest text-slate-400">{isUser ? "Você" : "IA"}</p>
                      {canApply && (
                        <button
                          onClick={() => handleApplyAiMessage(message.content)}
                          className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80 hover:border-emerald-400 hover:text-emerald-200"
                        >
                          Aplicar no editor
                        </button>
                      )}
                    </div>
                    <div
                      className="space-y-2 leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1 [&_p]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-400/60 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-300 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/30 [&_pre]:p-3 [&_pre]:text-xs [&_code]:rounded [&_code]:bg-black/20 [&_code]:px-1 [&_code]:py-0.5 [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-slate-700 [&_th]:border [&_th]:border-slate-700 [&_th]:bg-slate-900/80 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1 [&_strong]:font-semibold [&_del]:opacity-80"
                      dangerouslySetInnerHTML={{ __html: renderedContent }}
                    />
                  </div>
                );
              })}
              {!messages.length && (
                <p className="text-center text-sm text-slate-500">Inicie uma conversa para refinar este post com a IA.</p>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <textarea
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                placeholder="Sugira ajustes, peça melhorias, defina o tom..."
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
                rows={3}
              />
              <button
                onClick={handleSend}
                disabled={sending || aiLimitReached}
                className="rounded-2xl bg-emerald-400 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-400/30 disabled:opacity-50"
              >
                {sending ? "Gerando..." : aiLimitReached ? "Limite diário atingido" : "Enviar para IA"}
              </button>
              {aiLimitReached && aiUsage && (
                <p className="text-xs text-slate-400">
                  Você usou {aiUsage.requestCount} de {aiUsage.limit} hoje.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
