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

const BASE_URL = resolveApiBaseUrl();
const CSRF_COOKIE_NAME = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ?? "backblog.csrf";
const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type FetchOptions = RequestInit & {
  next?: { revalidate?: number };
};

export type ApiError = Error & { status?: number; data?: unknown };

function readBrowserCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${encodeURIComponent(name)}=`));
  if (!entry) return null;
  const [, value] = entry.split("=");
  return value ? decodeURIComponent(value) : null;
}

async function ensureBrowserCsrfToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const existing = readBrowserCookie(CSRF_COOKIE_NAME);
  if (existing) return existing;

  const response = await fetch(`${BASE_URL}/csrf-token`, {
    method: "GET",
    credentials: "include",
  }).catch(() => undefined);

  if (response?.ok) {
    try {
      const data = (await response.json()) as { csrfToken?: string };
      if (typeof data?.csrfToken === "string" && data.csrfToken.trim()) {
        return data.csrfToken.trim();
      }
    } catch {
      // ignora falha de parse e tenta fallback via cookie
    }
  }

  return readBrowserCookie(CSRF_COOKIE_NAME);
}

async function fetchPublic<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const config: FetchOptions = {
    ...options,
  };

  const method = (config.method || "GET").toUpperCase();

  if (typeof window === "undefined" && !config.next && method === "GET") {
    config.next = { revalidate: 60 };
  }

  if (!CSRF_SAFE_METHODS.has(method)) {
    const headers = new Headers(config.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const csrfToken = await ensureBrowserCsrfToken();
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }

    config.headers = headers;
    config.credentials = "include";
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorData: unknown;
    let message = `Falha ao acessar ${path}`;

    try {
      errorData = await response.json();
      if (errorData && typeof errorData === "object" && "message" in errorData) {
        const dataWithMessage = errorData as { message?: string };
        if (dataWithMessage.message) {
          message = dataWithMessage.message;
        }
      }
    } catch {
      // ignora parse de erro
    }

    const error: ApiError = new Error(message);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  return response.json();
}

export type PublicPost = {
  id: string;
  title: string;
  slug: string;
  blogName?: string;
  authorSlug?: string | null;
  excerpt?: string | null;
  contentFinal?: string | null;
  contentRaw?: string | null;
  status: "draft" | "published";
  readingTimeMin?: number | null;
  publishedAt?: string | null;
  year?: number | null;
  month?: number | null;
  day?: number | null;
  createdAt: string;
  updatedAt: string;
  tags: Array<{ id: number; name: string; slug: string }>;
};

export type PublicListResponse = {
  data: PublicPost[];
  meta: {
    page: number;
    limit: number;
    count: number;
  };
};

export type PublicBlogResponse = {
  profile: {
    displayName?: string | null;
    slug?: string | null;
    shortDescription?: string | null;
  };
  settings: {
    id: string;
    userId: string;
    blogName: string;
    blogTagline?: string | null;
    theme: FavoriteTheme;
    aboutText?: string | null;
    contactEmail?: string | null;
    socialLinks: Array<{ label: string; url: string }>;
    seoDescription?: string | null;
    updatedAt?: string;
  } | null;
  posts: PublicPost[];
  meta: {
    page: number;
    limit: number;
    count: number;
  };
};

type PublicBlogSettings = {
  id: string;
  blogName: string;
  blogTagline?: string | null;
  theme: FavoriteTheme;
  aboutText?: string | null;
  seoDescription?: string | null;
  contactEmail?: string | null;
  socialLinks?: Array<{ label: string; url: string }>;
};

export type PublicComment = {
  id: number;
  authorName?: string | null;
  content: string;
  createdAt?: string | null;
};

export type PublicCommentsPage = {
  total: number;
  page: number;
  limit: number;
  items: PublicComment[];
};

export type PublicPostEngagement = {
  postId: number;
  likes: number;
  viewerHasLiked: boolean;
  comments: PublicCommentsPage;
};

export type PostLikeState = {
  likes: number;
  viewerHasLiked: boolean;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
};

export type PublicUserStats = {
  totalUsers: number;
  onlineUsers: number;
};

export async function getBlogSettings(options?: { slug?: string }) {
  const params = new URLSearchParams();
  if (options?.slug) {
    params.set("slug", options.slug);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchPublic<PublicBlogSettings | null>(`/public/settings${query}`);
}

type FavoriteTheme = {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
  codeBlockBackground: string;
  codeInlineBackground: string;
  codeText: string;
  codeKeyword: string;
  codeString: string;
  codeNumber: string;
  codeComment: string;
  codeFunction: string;
};

export async function listPublishedPosts(options: {
  year?: number;
  month?: number;
  tag?: string;
  page?: number;
  limit?: number;
  search?: string;
}) {
  const params = new URLSearchParams();

  if (options.year) params.set("year", String(options.year));
  if (options.month) params.set("month", String(options.month));
  if (options.tag) params.set("tag", options.tag);
  if (options.search) params.set("search", options.search);
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));

  const query = params.toString() ? `?${params}` : "";
  return fetchPublic<PublicListResponse>(`/public/posts${query}`);
}

export async function getPublishedPost(year: number, month: number, slug: string) {
  return fetchPublic<PublicPost>(`/public/posts/${year}/${month}/${slug}`);
}

export async function getAuthorPublishedPost(
  authorSlug: string,
  year: number | string,
  month: number | string,
  postSlug: string,
) {
  return fetchPublic<PublicPost>(
    `/public/blogs/${authorSlug}/posts/${year}/${month}/${postSlug}`,
  );
}

export async function getAuthorBlog(slug: string, options?: { page?: number; limit?: number; search?: string }) {
  const params = new URLSearchParams();
  if (options?.page) {
    params.set("page", String(options.page));
  }
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }
  if (options?.search) {
    params.set("search", options.search);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchPublic<PublicBlogResponse>(`/public/blogs/${slug}${query}`);
}

export async function getPostEngagement(
  year: number | string,
  month: number | string,
  slug: string,
  options?: { visitorId?: string; page?: number; limit?: number },
) {
  const params = new URLSearchParams();
  if (options?.visitorId) params.set("visitorId", options.visitorId);
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchPublic<PublicPostEngagement>(`/public/posts/${year}/${month}/${slug}/engagement${query}`);
}

export async function togglePostLike(
  year: number | string,
  month: number | string,
  slug: string,
  payload: { action: "like" | "unlike"; visitorId: string },
) {
  return fetchPublic<PostLikeState>(`/public/posts/${year}/${month}/${slug}/likes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createPostComment(
  year: number | string,
  month: number | string,
  slug: string,
  payload: { authorName?: string; authorEmail?: string; content: string },
) {
  return fetchPublic<{ message: string; comment: { id: number; status: string; createdAt?: string } }>(
    `/public/posts/${year}/${month}/${slug}/comments`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function getUserStats() {
  return fetchPublic<PublicUserStats>("/public/stats/users");
}

export async function registerUser(payload: RegisterPayload) {
  return fetchPublic<{ message: string }>("/public/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listPostComments(
  year: number | string,
  month: number | string,
  slug: string,
  options?: { page?: number; limit?: number },
) {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchPublic<PublicCommentsPage>(`/public/posts/${year}/${month}/${slug}/comments${query}`);
}
