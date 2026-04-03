"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDateTimeBR } from "@/lib/dateTime";
import type { BlogSettings } from "@/types";
import { BlogPreview } from "@/components/BlogPreview";
import { useAuth } from "@/contexts/AuthContext";

type FormState = {
  blogName: string;
  blogTagline: string;
  theme: BlogSettings["theme"];
  aboutText: string;
  contactEmail: string;
  seoDescription: string;
  socialLinks: Array<{ label: string; url: string }>;
};

const defaultTheme = {
  primary: "#0f172a",
  secondary: "#14b8a6",
  background: "#ffffff",
  text: "#0f172a",
  accent: "#14b8a6",
  codeBlockBackground: "#0f172a",
  codeInlineBackground: "#1e293b",
  codeText: "#e2e8f0",
  codeKeyword: "#7dd3fc",
  codeString: "#86efac",
  codeNumber: "#fbbf24",
  codeComment: "#94a3b8",
  codeFunction: "#c4b5fd",
};

const normalizeTheme = (theme?: Partial<BlogSettings["theme"]>) => ({
  ...defaultTheme,
  ...(theme || {}),
});

const themeFieldLabels: Record<keyof BlogSettings["theme"], string> = {
  primary: "Primária",
  secondary: "Secundária",
  background: "Fundo",
  text: "Texto",
  accent: "Destaque",
  codeBlockBackground: "Bloco de código",
  codeInlineBackground: "Código inline",
  codeText: "Texto do código",
  codeKeyword: "Palavra-chave",
  codeString: "Texto",
  codeNumber: "Número",
  codeComment: "Comentário",
  codeFunction: "Função",
};

const baseThemeFields: Array<keyof BlogSettings["theme"]> = ["primary", "secondary", "background", "text", "accent"];
const codeSurfaceThemeFields: Array<keyof BlogSettings["theme"]> = ["codeBlockBackground", "codeInlineBackground", "codeText"];
const codeSyntaxThemeFields: Array<keyof BlogSettings["theme"]> = [
  "codeKeyword",
  "codeString",
  "codeNumber",
  "codeComment",
  "codeFunction",
];

export default function BlogSettingsPage() {
  const [settings, setSettings] = useState<BlogSettings | null>(null);
  const [form, setForm] = useState<FormState>({
    blogName: "",
    blogTagline: "",
    theme: defaultTheme,
    aboutText: "",
    contactEmail: "",
    seoDescription: "",
    socialLinks: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  const handleOpenDeleteModal = () => {
    setDeleteInput("");
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    if (deletingAccount) {
      return;
    }
    setShowDeleteModal(false);
    setDeleteInput("");
    setDeleteError(null);
  };

  const deleteConfirmationValid = deleteInput.trim().toUpperCase() === "EXCLUIR";

  const handleConfirmAccountDeletion = async () => {
    if (!deleteConfirmationValid) {
      return;
    }

    setDeletingAccount(true);
    setDeleteError(null);
    try {
      await api.deleteAccount();
      await refresh().catch(() => undefined);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("backblog.accountDeleted", "1");
      }
      router.push("/");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Não foi possível excluir sua conta.");
    } finally {
      setDeletingAccount(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.getSettings();
        setSettings(data);
        setForm({
          blogName: data.blogName,
          blogTagline: data.blogTagline ?? "",
          theme: normalizeTheme(data.theme),
          aboutText: data.aboutText ?? "",
          contactEmail: data.contactEmail ?? "",
          seoDescription: data.seoDescription ?? "",
          socialLinks: data.socialLinks ?? [],
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Não foi possível carregar suas configurações.");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const livePreviewSettings = useMemo<BlogSettings>(() => {
    if (!settings) {
      return {
        id: "preview",
        userId: "preview",
        blogName: form.blogName || "Meu Blog",
        blogTagline: form.blogTagline,
        theme: form.theme,
        aboutText: form.aboutText,
        contactEmail: form.contactEmail,
        socialLinks: form.socialLinks,
        seoDescription: form.seoDescription,
      };
    }

    return {
      ...settings,
      blogName: form.blogName,
      blogTagline: form.blogTagline,
      theme: form.theme,
      aboutText: form.aboutText,
      contactEmail: form.contactEmail,
      socialLinks: form.socialLinks,
      seoDescription: form.seoDescription,
    };
  }, [settings, form]);

  const handleThemeChange = (key: keyof FormState["theme"], value: string) => {
    setForm((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        [key]: value,
      },
    }));
  };

  const themeFields = [...baseThemeFields, ...codeSurfaceThemeFields, ...codeSyntaxThemeFields].map(
    (key) => [key, form.theme[key] ?? defaultTheme[key]] as const,
  );

  const handleSocialLinkChange = (index: number, field: "label" | "url", value: string) => {
    setForm((prev) => {
      const nextLinks = [...prev.socialLinks];
      nextLinks[index] = {
        ...nextLinks[index],
        [field]: value,
      };
      return { ...prev, socialLinks: nextLinks };
    });
  };

  const handleAddSocialLink = () => {
    setForm((prev) => ({
      ...prev,
      socialLinks: [...prev.socialLinks, { label: "", url: "" }],
    }));
  };

  const handleRemoveSocialLink = (index: number) => {
    setForm((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((_, idx) => idx !== index),
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const normalizedSocialLinks = form.socialLinks
        .map((link) => ({
          label: link.label.trim(),
          url: link.url.trim(),
        }))
        .filter((link) => link.label || link.url);

      const updated = await api.updateSettings({
        blogName: form.blogName,
        blogTagline: form.blogTagline,
        theme: form.theme,
        aboutText: form.aboutText,
        contactEmail: form.contactEmail.trim() || undefined,
        socialLinks: normalizedSocialLinks,
        seoDescription: form.seoDescription,
      });
      setSettings({
        ...updated,
        theme: normalizeTheme(updated.theme),
      });
      setForm((prev) => ({
        ...prev,
        theme: normalizeTheme(updated.theme),
      }));
      setMessage("Configurações atualizadas com sucesso ✅");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 text-slate-400">
        carregando preferências...
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-16">
      <header>
        <p className="text-xs uppercase tracking-[0.5em] text-emerald-400">aparência</p>
        <h1 className="text-3xl font-semibold text-white">Seu blog</h1>
        <p className="text-sm text-slate-400">Personalize o que aparecerá no site público e veja o preview em tempo real.</p>
      </header>

      {message && (
        <p className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">{message}</p>
      )}

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5 rounded-3xl border border-slate-900 bg-slate-900/50 p-5">
          <h2 className="text-lg font-semibold text-white">Identidade</h2>

          <label className="text-sm text-slate-300">
            Nome do blog
            <input
              value={form.blogName}
              onChange={(event) => setForm((prev) => ({ ...prev, blogName: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
              placeholder="Ex.: Reflexões do Gabriel"
              required
            />
          </label>

          <label className="text-sm text-slate-300">
            Slogan / Tagline
            <input
              value={form.blogTagline}
              onChange={(event) => setForm((prev) => ({ ...prev, blogTagline: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
              placeholder="Texto curto para acompanhar o nome"
            />
          </label>

          <label className="text-sm text-slate-300">
            Descrição SEO (até 180 caracteres)
            <textarea
              value={form.seoDescription}
              onChange={(event) => setForm((prev) => ({ ...prev, seoDescription: event.target.value }))}
              maxLength={180}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
              rows={3}
            />
          </label>

          <label className="text-sm text-slate-300">
            Sobre
            <textarea
              value={form.aboutText}
              onChange={(event) => setForm((prev) => ({ ...prev, aboutText: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
              rows={4}
              placeholder="Conte às pessoas quem você é."
            />
          </label>

          <label className="text-sm text-slate-300">
            E-mail de contato
            <input
              type="email"
              value={form.contactEmail}
              onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white"
              placeholder="contato@seudominio.com"
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm text-slate-300">Links sociais</p>
            {form.socialLinks.map((link, index) => (
              <div key={`social-${index}`} className="flex gap-2">
                <input
                  value={link.label}
                  onChange={(event) => handleSocialLinkChange(index, "label", event.target.value)}
                  placeholder="Nome"
                  className="w-1/3 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <input
                  value={link.url}
                  onChange={(event) => handleSocialLinkChange(index, "url", event.target.value)}
                  placeholder="https://"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveSocialLink(index)}
                  className="rounded-2xl border border-slate-800 px-3 text-xs text-slate-400"
                >
                  remover
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddSocialLink}
              className="text-xs font-semibold text-emerald-400 underline underline-offset-4"
            >
              + adicionar link
            </button>
          </div>
        </div>

        <div className="space-y-5 rounded-3xl border border-slate-900 bg-slate-900/50 p-5">
          <h2 className="text-lg font-semibold text-white">Cores</h2>
          <p className="text-xs text-slate-400">Ajuste também as cores de código para a publicação final.</p>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Base do tema</p>
            {themeFields
              .filter(([key]) => baseThemeFields.includes(key))
              .map(([key, value]) => (
                <label key={key} className="flex items-center justify-between text-sm text-slate-300">
                  <span>{themeFieldLabels[key]}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={value}
                      onChange={(event) => handleThemeChange(key, event.target.value)}
                      className="h-10 w-12 cursor-pointer rounded border border-slate-700 bg-transparent"
                    />
                    <input
                      value={value}
                      onChange={(event) => handleThemeChange(key, event.target.value)}
                      className="w-28 rounded-xl border border-slate-800 bg-slate-950 px-2 py-2 text-xs text-white"
                    />
                  </div>
                </label>
              ))}
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Código no post</p>
            <p className="text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{"{ }"}</span> = bloco de código,{" "}
              <span className="font-semibold text-slate-200">{"</>"}</span> = código inline.
            </p>
            {themeFields
              .filter(([key]) => codeSurfaceThemeFields.includes(key))
              .map(([key, value]) => (
                <label key={key} className="flex items-center justify-between text-sm text-slate-300">
                  <span>{themeFieldLabels[key]}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={value}
                      onChange={(event) => handleThemeChange(key, event.target.value)}
                      className="h-10 w-12 cursor-pointer rounded border border-slate-700 bg-transparent"
                    />
                    <input
                      value={value}
                      onChange={(event) => handleThemeChange(key, event.target.value)}
                      className="w-28 rounded-xl border border-slate-800 bg-slate-950 px-2 py-2 text-xs text-white"
                    />
                  </div>
                </label>
              ))}

            <p className="pt-1 text-xs font-semibold uppercase tracking-widest text-emerald-300">Sintaxe do código</p>
            {themeFields
              .filter(([key]) => codeSyntaxThemeFields.includes(key))
              .map(([key, value]) => (
                <label key={key} className="flex items-center justify-between text-sm text-slate-300">
                  <span>{themeFieldLabels[key]}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={value}
                      onChange={(event) => handleThemeChange(key, event.target.value)}
                      className="h-10 w-12 cursor-pointer rounded border border-slate-700 bg-transparent"
                    />
                    <input
                      value={value}
                      onChange={(event) => handleThemeChange(key, event.target.value)}
                      className="w-28 rounded-xl border border-slate-800 bg-slate-950 px-2 py-2 text-xs text-white"
                    />
                  </div>
                </label>
              ))}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-emerald-400 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-400/40 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar mudanças"}
          </button>
        </div>
      </form>

      <section className="rounded-3xl border border-slate-900 bg-slate-900/40 p-5">
        <div className="mb-4 flex items-center justify-between text-sm text-slate-400">
          <p>Preview público</p>
          <span>{formatDateTimeBR(livePreviewSettings.updatedAt ?? Date.now())}</span>
        </div>
        <BlogPreview settings={livePreviewSettings} />
      </section>

      <section className="rounded-3xl border border-rose-500/30 bg-rose-900/10 p-5 text-rose-100">
        <h2 className="text-lg font-semibold text-white">Excluir conta</h2>
        <p className="mt-2 text-sm text-rose-100/80">
          Ao excluir sua conta, todos os seus textos, configurações e acesso serão removidos permanentemente. Não é possível reverter
          esta ação.
        </p>
        <button
          type="button"
          onClick={handleOpenDeleteModal}
          className="mt-4 w-full rounded-2xl border border-rose-400 bg-transparent py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/10"
        >
          Excluir conta
        </button>
      </section>

      {showDeleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-900 bg-slate-900/90 p-6 shadow-2xl shadow-rose-900/40">
            <p className="text-xs uppercase tracking-[0.4em] text-rose-300">atenção</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Tem certeza que deseja excluir sua conta?</h3>
            <p className="mt-4 text-sm text-slate-300">
              Isso apagará tudo o que você escreveu aqui. Seus textos, configurações e acesso serão removidos para sempre. Se ainda assim
              quiser prosseguir, estamos aqui para respeitar sua escolha.
            </p>

            <label className="mt-6 block text-sm text-slate-200">
              Para confirmar, digite: <span className="font-semibold text-rose-200">EXCLUIR</span>
              <input
                value={deleteInput}
                onChange={(event) => setDeleteInput(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-base text-white outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/30"
                placeholder="EXCLUIR"
              />
            </label>

            {deleteError ? <p className="mt-3 text-sm text-rose-300">{deleteError}</p> : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
              <button
                type="button"
                disabled={!deleteConfirmationValid || deletingAccount}
                onClick={handleConfirmAccountDeletion}
                className="rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingAccount ? "Excluindo..." : "Excluir conta permanentemente"}
              </button>
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
                disabled={deletingAccount}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
