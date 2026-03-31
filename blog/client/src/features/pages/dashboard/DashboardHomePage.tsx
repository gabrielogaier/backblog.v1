"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Post, UserProfile } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { UserProfileModal } from "@/components/UserProfileModal";

type PostsResponse = {
  data: Post[];
};

const featureLinks = [
  {
    title: "Posts & editor",
    description: "Crie, edite e publique com o editor Tiptap e refine com a IA.",
    href: "/admin/posts",
  },
  {
    title: "Moderar comentários",
    description: "Aprove, oculte ou revise o feedback que chega pelo seu blog público.",
    href: "/admin/comentarios",
  },
  {
    title: "Tema e identidade visual",
    description: "Escolha cores, textos e SEO que aparecem no site público.",
    href: "/admin/settings",
  },
  {
    title: "Alinhamento da IA",
    description: "Revise valores, tom e lições que orientam cada post.",
    href: "/admin/alinhamento",
  },
  {
    title: "Faça uma doação",
    description: "Ajude a cobrir servidores e desenvolvimento contínuo do Backblog.",
    href: "/doar",
  },
];

export default function DashboardHomePage() {
  const { user, logout } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null | undefined>();

  const profileIncomplete = useMemo(() => {
    if (profile === undefined) {
      return false;
    }

    if (!profile) {
      return true;
    }

    const hasName = Boolean(profile.displayName && profile.displayName.trim().length > 0);
    const hasSlug = Boolean(profile.slug && profile.slug.trim().length > 0);
    const hasDescription = Boolean(profile.shortDescription && profile.shortDescription.trim().length > 0);

    return !hasName || !hasSlug || !hasDescription;
  }, [profile]);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response: PostsResponse = await api.posts();
        setPosts(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível carregar seus posts.");
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const result = await api.getProfile();
        if (isMounted) {
          setProfile(result);
        }
      } catch {
        if (isMounted) {
          setProfile(null);
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const greetingName =
    (profile?.displayName && profile.displayName.trim().length > 0 ? profile.displayName : null) ??
    user?.name ??
    user?.email?.split("@")[0] ??
    "administrador";

  const handleProfileSave = async (payload: {
    displayName: string;
    slug: string;
    shortDescription: string;
  }) => {
    const updated = await api.updateProfile(payload);
    setProfile(updated);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-4 pb-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-400">painel</p>
          <h1 className="text-2xl font-semibold text-white">Olá, {greetingName}</h1>
        </div>
        <div className="flex items-center gap-2">
          {profile?.slug && (
            <Link
              href={`/blog/${profile.slug}`}
              target="_blank"
              className="rounded-full border border-emerald-500/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-300 hover:border-emerald-300"
            >
              ver blog
            </Link>
          )}
          <button
            onClick={logout}
            className="rounded-full border border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300"
          >
            sair
          </button>
        </div>
      </header>

      <section className="mt-4 grid gap-4 rounded-3xl border border-slate-900 bg-slate-900/50 p-4 md:grid-cols-2">
        {featureLinks.map((feature) => (
          <Link
            key={feature.title}
            href={feature.href}
            className="flex flex-col gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 transition hover:border-emerald-300/60"
          >
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">{feature.title}</p>
            <p className="text-sm text-slate-300">{feature.description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-900 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Seus posts</h2>
          <span className="text-sm text-slate-500">{posts.length} itens</span>
        </div>

        {loading && (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="h-16 animate-pulse rounded-2xl bg-slate-800/50" />
            ))}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

        {!loading && !error && (
          <ul className="mt-4 flex flex-col gap-3">
            {posts.map((post) => (
              <li key={post.id} className="list-none">
                <Link
                  href={`/admin/posts/${post.id}`}
                  className="flex min-h-[120px] flex-col gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 transition hover:border-emerald-300/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-white break-words text-balance line-clamp-2">
                      {post.title}
                    </p>
                    <span
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                        post.status === "published"
                          ? "bg-emerald-400/20 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {post.status === "published" ? "Publicado" : "Rascunho"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 break-words">
                    {post.excerpt || "Sem resumo ainda"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <UserProfileModal open={profileIncomplete} profile={profile ?? undefined} onSave={handleProfileSave} />
    </div>
  );
}
