"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "@/types";

type Props = {
  open: boolean;
  profile?: UserProfile | null;
  onSave: (payload: { displayName: string; slug: string; shortDescription: string }) => Promise<void>;
};

export function UserProfileModal({ open, profile, onSave }: Props) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [slug, setSlug] = useState(profile?.slug ?? "");
  const [shortDescription, setShortDescription] = useState(profile?.shortDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDisplayName(profile?.displayName ?? "");
    setSlug(profile?.slug ?? "");
    setShortDescription(profile?.shortDescription ?? "");
  }, [open, profile]);

  const exampleUrl = useMemo(
    () => `https://backblog.inf.br/${slug ? slug : "exemplo"}`,
    [slug],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!displayName.trim() || !slug.trim() || !shortDescription.trim()) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        displayName: displayName.trim(),
        slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
        shortDescription: shortDescription.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div className="w-full max-w-2xl rounded-3xl border border-emerald-400/40 bg-slate-900/90 p-6 shadow-2xl shadow-emerald-900/60">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Alinhamento da IA</p>
          <h2 className="text-2xl font-semibold text-white">Fale sobre você</h2>
          <p className="text-sm text-slate-400">
            Essas informações geram automaticamente a instrução da IA e o slug do blog. Você pode editar depois sempre
            que quiser.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Nome que aparecerá nas publicações
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Ex: Gabriel A."
              className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Slug público
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="exemplo"
              className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
            />
            <p className="text-xs text-slate-400">
              Seu blog público ficará disponível em{" "}
              <span className="text-emerald-300">{exampleUrl}</span>. Não se preocupe, você pode alterar depois.
            </p>
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Como você se descreve em poucas palavras?
            <input
              value={shortDescription}
              onChange={(event) => setShortDescription(event.target.value)}
              placeholder="Ex: músico, escritor e tech lover"
              className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
            />
          </label>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar e continuar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
