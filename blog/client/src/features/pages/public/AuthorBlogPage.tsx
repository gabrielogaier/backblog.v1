import type { CSSProperties } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthorBlog } from "@/lib/publicApi";
import { AuthorBlogHeader } from "@/components/AuthorBlogHeader";
import { AuthorBlogPosts } from "@/components/AuthorBlogPosts";

const defaultTheme = {
  primary: "#0f172a",
  secondary: "#14b8a6",
  background: "#ffffff",
  text: "#0f172a",
  accent: "#22d3ee",
  codeBlockBackground: "#0f172a",
  codeInlineBackground: "#1e293b",
  codeText: "#e2e8f0",
  codeKeyword: "#7dd3fc",
  codeString: "#86efac",
  codeNumber: "#fbbf24",
  codeComment: "#94a3b8",
  codeFunction: "#c4b5fd",
};

type BlogParams = { slug: string };
type BlogSearchParams = { search?: string };

async function fetchBlog(slug: string, search?: string) {
  try {
    return await getAuthorBlog(slug, search ? { search } : undefined);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<BlogParams> }): Promise<Metadata> {
  const { slug } = await params;
  const blog = await fetchBlog(slug);
  if (!blog) {
    return { title: "Blog não encontrado | Backblog" };
  }

  const title = blog.settings?.blogName ?? blog.profile.displayName ?? "Backblog";
  const description =
    blog.settings?.seoDescription ??
    blog.profile.shortDescription ??
    "Blog publicado com Backblog, IA e revisões auditáveis.";

  return {
    title: `${title} | Backblog`,
    description,
  };
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AuthorBlogPage({
  params,
  searchParams,
}: {
  params: Promise<BlogParams>;
  searchParams?: Promise<BlogSearchParams>;
}) {
  const { slug } = await params;
  const search = searchParams ? (await searchParams)?.search : undefined;
  const blog = await fetchBlog(slug, search);

  if (!blog) {
    notFound();
  }

  const theme = blog.settings?.theme ?? defaultTheme;
  const aboutText = blog.settings?.aboutText || blog.profile.shortDescription || "Sobre ainda não definido.";
  const contactEmail = blog.settings?.contactEmail;
  const socialLinks = blog.settings?.socialLinks ?? [];

  return (
    <div
      style={
        {
          "--blog-bg": theme.background,
          "--blog-text": theme.text,
          "--blog-accent": theme.accent,
          "--blog-primary": theme.primary,
          "--blog-secondary": theme.secondary,
          backgroundColor: theme.background,
          color: theme.text,
        } as CSSProperties
      }
      className="min-h-screen bg-[var(--blog-bg)] text-[var(--blog-text)]"
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <AuthorBlogHeader
          blogName={blog.settings?.blogName ?? blog.profile.displayName ?? "Autor sem nome"}
          blogTagline={blog.settings?.blogTagline}
          theme={theme}
          slug={slug}
          aboutText={aboutText}
          contactEmail={contactEmail}
          socialLinks={socialLinks}
          postsHref="#posts"
        />

        <div id="posts" className="mt-10">
          <AuthorBlogPosts posts={blog.posts} slug={slug} theme={theme} />
        </div>
      </div>
    </div>
  );
}
