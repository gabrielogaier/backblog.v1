"use client";

import { useCallback, useMemo, useState } from "react";

type Theme = {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
};

type Props = {
  blogName: string;
  blogTagline?: string | null;
  theme: Theme;
  slug?: string;
  aboutText: string;
  contactEmail?: string | null;
  socialLinks: Array<{ label: string; url: string }>;
  onPanelChange?: (panel: "none" | "about" | "contact") => void;
  postsHref?: string;
};

function toTranslucent(color: string, alpha: number) {
  if (!color.startsWith("#")) {
    return color;
  }
  const hex = color.replace("#", "");
  const normalized = hex.length === 3 ? hex.replace(/./g, (ch) => ch + ch) : hex.padEnd(6, "0");
  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function AuthorBlogHeader({
  blogName,
  blogTagline,
  theme,
  slug,
  aboutText,
  contactEmail,
  socialLinks,
  onPanelChange,
  postsHref,
}: Props) {
  const [activePanel, setActivePanel] = useState<"none" | "about" | "contact">("none");

  const handleToggle = useCallback(
    (value: "about" | "contact" | "none") => {
      setActivePanel((current) => {
        const next = value === "none" ? "none" : current === value ? "none" : value;
        onPanelChange?.(next);
        return next;
      });
    },
    [onPanelChange],
  );

  const panelContent = useMemo(() => {
    if (activePanel === "about") {
      return (
        <div
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: toTranslucent(theme.primary, 0.3), backgroundColor: toTranslucent(theme.primary, 0.08) }}
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold uppercase tracking-[0.3em]" style={{ color: theme.primary }}>
              Sobre o autor
            </p>
            <button
              type="button"
              onClick={() => handleToggle("none")}
              className="text-xs font-semibold uppercase tracking-[0.3em]"
              style={{ color: theme.secondary }}
            >
              Recolher
            </button>
          </div>
          <p className="mt-2 whitespace-pre-line opacity-80">{aboutText}</p>
        </div>
      );
    }

    if (activePanel === "contact") {
      return (
        <div
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: toTranslucent(theme.secondary, 0.3), backgroundColor: toTranslucent(theme.secondary, 0.08) }}
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold uppercase tracking-[0.3em]" style={{ color: theme.secondary }}>
              Contato
            </p>
            <button
              type="button"
              onClick={() => handleToggle("none")}
              className="text-xs font-semibold uppercase tracking-[0.3em]"
              style={{ color: theme.secondary }}
            >
              Recolher
            </button>
          </div>
          {contactEmail ? (
            <p className="mt-2">
              E-mail:{" "}
              <a href={`mailto:${contactEmail}`} className="font-semibold hover:underline" style={{ color: theme.secondary }}>
                {contactEmail}
              </a>
            </p>
          ) : (
            <p className="mt-2 opacity-70">O autor ainda não informou um e-mail.</p>
          )}
          {socialLinks.length ? (
            <ul className="mt-3 space-y-1">
              {socialLinks.map((link) => (
                <li key={`${link.label}-${link.url}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: theme.secondary }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }

    return null;
  }, [activePanel, theme, aboutText, contactEmail, socialLinks, handleToggle]);

  return (
    <div className="space-y-3">
      <header
        className="sticky top-0 z-30 rounded-3xl border px-4 py-5 shadow-xl backdrop-blur transition"
        style={{
          borderColor: `${theme.primary}55`,
          backgroundColor: `${theme.background}EE`,
          color: theme.text,
        }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <small className="text-xs uppercase tracking-[0.4em]" style={{ color: theme.secondary }}>
              Blog público
            </small>
            {slug ? (
              <a href={`/blog/${slug}`} className="text-3xl font-semibold block" style={{ color: theme.primary }}>
                {blogName}
              </a>
            ) : (
              <p className="text-3xl font-semibold" style={{ color: theme.primary }}>
                {blogName}
              </p>
            )}
            {blogTagline && <p className="text-sm opacity-80">{blogTagline}</p>}
          </div>
          <nav className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide">
            <a href={postsHref ?? "#posts"} style={{ color: theme.text }}>
              Posts
            </a>
            <button
              type="button"
              onClick={() => handleToggle("about")}
              className="hover:text-[var(--blog-secondary)]"
              style={{ color: theme.text }}
            >
              Sobre
            </button>
            <button
              type="button"
              onClick={() => handleToggle("contact")}
              className="hover:text-[var(--blog-secondary)]"
              style={{ color: theme.text }}
            >
              Contato
            </button>
          </nav>
        </div>
      </header>
      {panelContent}
    </div>
  );
}
