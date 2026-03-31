"use client";

import type {
  BlogSettings,
  Conversation,
  ConversationMessage,
  ModerationComment,
  Post,
  PostRevision,
  UploadedImage,
  User,
  UserProfile,
} from "@/types";

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function resolveApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4010/api";

  if (typeof window === "undefined") {
    return configuredBaseUrl;
  }

  try {
    const parsed = new URL(configuredBaseUrl, window.location.origin);
    if (isLoopbackHost(parsed.hostname) && parsed.hostname !== window.location.hostname) {
      parsed.hostname = window.location.hostname;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return configuredBaseUrl;
  }
}

const API_BASE_URL = resolveApiBaseUrl();
const CSRF_COOKIE_NAME = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? "backblog.csrf";
const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const AUTH_RETRY_EXCLUDED_PATHS = new Set(["/admin/auth/login", "/admin/auth/refresh", "/admin/auth/logout"]);

const API_ORIGIN =
  (() => {
    try {
      return new URL(API_BASE_URL).origin;
    } catch {
      return "";
    }
  })() || "";

function toAbsoluteAssetUrl(path: string) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_ORIGIN) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

type FetchOptions = RequestInit;
let refreshInFlight: Promise<boolean> | null = null;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${encodeURIComponent(name)}=`));
  if (!entry) return null;
  const [, value] = entry.split("=");
  return value ? decodeURIComponent(value) : null;
}

async function ensureCsrfToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const existing = readCookie(CSRF_COOKIE_NAME);
  if (existing) return existing;

  await fetch(`${API_BASE_URL}/csrf-token`, {
    method: "GET",
    credentials: "include",
  }).catch(() => undefined);

  return readCookie(CSRF_COOKIE_NAME);
}

async function executeFetch(path: string, options: FetchOptions, csrfToken?: string | null) {
  const { headers, body, ...rest } = options;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const mergedHeaders = new Headers(headers);
  const isAdminPath = path.startsWith("/admin/");
  const method = String(rest.method || "GET").toUpperCase();

  if (!isFormData && !mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }

  if (!CSRF_SAFE_METHODS.has(method) && csrfToken) {
    mergedHeaders.set("X-CSRF-Token", csrfToken);
  }

  if (isAdminPath && method === "GET") {
    mergedHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
    mergedHeaders.set("Pragma", "no-cache");
    mergedHeaders.set("Expires", "0");
    mergedHeaders.delete("If-None-Match");
    mergedHeaders.delete("If-Modified-Since");
  }

  return fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    cache: rest.cache ?? (isAdminPath ? "no-store" : undefined),
    headers: mergedHeaders,
    body,
    ...rest,
  });
}

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const csrfToken = await ensureCsrfToken();
      const response = await executeFetch("/admin/auth/refresh", { method: "POST" }, csrfToken);
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const method = String(options.method || "GET").toUpperCase();
  const csrfToken = !CSRF_SAFE_METHODS.has(method) ? await ensureCsrfToken() : null;
  let response = await executeFetch(path, options, csrfToken);

  if (response.status === 304) {
    response = await executeFetch(
      path,
      {
        ...options,
        cache: "no-store",
      },
      csrfToken,
    );
  }

  if (response.status === 401 && !AUTH_RETRY_EXCLUDED_PATHS.has(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retryCsrfToken = !CSRF_SAFE_METHODS.has(method) ? await ensureCsrfToken() : null;
      response = await executeFetch(path, options, retryCsrfToken);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message = (data as { message?: string })?.message ?? "Erro inesperado. Tente novamente.";
    throw new Error(message);
  }

  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<{ user: User; session: { expiresAt: string } }>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    apiFetch<void>("/admin/auth/logout", {
      method: "POST",
    }),
  me: (options?: FetchOptions) => apiFetch<{ user: User }>("/admin/auth/me", options),
  posts: () => apiFetch<{ data: Post[] }>("/admin/posts"),
  createPost: (payload: Partial<Post> & { title: string }) =>
    apiFetch<Post>("/admin/posts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  post: (id: string) => apiFetch<Post>(`/admin/posts/${id}`),
  updatePost: (id: string, payload: Partial<Post> & Record<string, unknown>) =>
    apiFetch<Post>(`/admin/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deletePost: (id: string) =>
    apiFetch<void>(`/admin/posts/${id}`, {
      method: "DELETE",
    }),
  conversations: (postId: string) => apiFetch<{ data: Conversation[] }>(`/admin/posts/${postId}/conversations`),
  createConversation: (postId: string, title: string) =>
    apiFetch<Conversation>(`/admin/posts/${postId}/conversations`, {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  conversationMessages: (postId: string, conversationId: string) =>
    apiFetch<{ data: ConversationMessage[] }>(`/admin/posts/${postId}/conversations/${conversationId}/messages`),
  sendConversationMessage: (
    postId: string,
    conversationId: string,
    payload: { content: string; draft?: string; instructionId?: number },
  ) =>
    apiFetch<{ userMessage: ConversationMessage; aiMessage: ConversationMessage }>(
      `/admin/posts/${postId}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  ensureConversation: (postId: string) =>
    apiFetch<Conversation>(`/admin/posts/${postId}/conversations`, {
      method: "POST",
      body: JSON.stringify({ title: "Nova conversa" }),
    }),
  listRevisions: (postId: string, source?: "ai" | "human") => {
    const query = source ? `?source=${source}` : "";
    return apiFetch<{ data: PostRevision[] }>(`/admin/posts/${postId}/revisions${query}`);
  },
  getRevision: (postId: string, revisionId: string) =>
    apiFetch<PostRevision>(`/admin/posts/${postId}/revisions/${revisionId}`),
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const uploaded = await apiFetch<UploadedImage>("/admin/uploads/images", {
      method: "POST",
      body: formData,
    });
    return {
      ...uploaded,
      url: toAbsoluteAssetUrl(uploaded.url),
    };
  },
  getSettings: () => apiFetch<BlogSettings>("/admin/settings"),
  updateSettings: (payload: Partial<BlogSettings>) =>
    apiFetch<BlogSettings>("/admin/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getProfile: () => apiFetch<UserProfile>("/admin/profile"),
  updateProfile: (payload: {
    displayName: string;
    slug: string;
    shortDescription: string;
    alignment?: Record<string, string>;
  }) =>
    apiFetch<UserProfile>("/admin/profile", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listComments: (options?: { status?: "pending" | "approved" | "hidden"; page?: number; limit?: number; search?: string }) => {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.search) params.set("search", options.search);
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<{ data: ModerationComment[]; meta: { page: number; limit: number; total: number } }>(
      `/admin/comments${query}`,
    );
  },
  updateCommentStatus: (id: number, status: "pending" | "approved" | "hidden") =>
    apiFetch<{ id: number; postId: number; status: string }>(`/admin/comments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  deleteAccount: () =>
    apiFetch<{ message: string }>("/admin/auth/account", {
      method: "DELETE",
    }),
};
