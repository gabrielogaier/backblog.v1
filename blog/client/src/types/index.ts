export type User = {
  id: string;
  email: string;
  name?: string;
  role: string;
  emailVerified?: boolean;
};

export type AiUsage = {
  usageDate: string;
  limit: number;
  requestCount: number;
  remaining: number;
  reachedLimit: boolean;
};

export type Post = {
  id: string;
  title: string;
  status: "draft" | "published";
  excerpt?: string;
  contentRaw?: string | null;
  contentFinal?: string | null;
  tags: Array<{ id: number; name: string; slug: string }>;
  updatedAt: string;
  createdAt?: string;
  publishedAt?: string | null;
  aiUsage?: AiUsage | null;
};

export type Conversation = {
  id: string;
  postId: string;
  title: string;
  status: string;
  updatedAt: string;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  role: "user" | "ai" | "system";
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

export type PostRevision = {
  id: string;
  postId: string;
  source: "ai" | "human";
  content: string;
  notes?: string | null;
  createdAt: string;
};

export type BlogSettings = {
  id: string;
  userId: string;
  blogName: string;
  blogTagline?: string | null;
  theme: {
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
  aboutText?: string | null;
  contactEmail?: string | null;
  socialLinks: Array<{ label: string; url: string }>;
  seoDescription?: string | null;
  updatedAt?: string;
};

export type UserProfile = {
  id: string;
  userId: string;
  displayName?: string | null;
  slug?: string | null;
  shortDescription?: string | null;
  aiInstruction?: string | null;
  alignment?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type UploadedImage = {
  url: string;
  path: string;
  size: number;
  mimeType: string;
  originalName: string;
};

export type ModerationComment = {
  id: number;
  postId: number;
  postTitle: string;
  postSlug: string;
  postYear?: number | null;
  postMonth?: number | null;
  authorName?: string | null;
  authorEmail?: string | null;
  content: string;
  status: 'pending' | 'approved' | 'hidden';
  createdAt?: string | null;
};
