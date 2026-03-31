"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { UserProfile } from "@/types";

const fieldGroups = [
  {
    title: "1) Identidade do Autor",
    description: "Conte quem é você (idade, localização, descrição breve) para que a IA aprenda a voz inicial.",
    fields: [
      {
        key: "identityAuthor",
        label: "Identidade e contexto",
        placeholder: "Ex: Gabriel, 34 anos, mora em SP, autor reflexivo e curioso.",
      },
    ],
  },
  {
    title: "2) Ocupação & Pilares da Vida",
    description: "Fale sobre sua ocupação, áreas de foco e tópicos que domina.",
    fields: [
      {
        key: "occupations",
        label: "Ocupações principais",
        placeholder: "Ex: músico, programador e criador de conteúdo.",
      },
      {
        key: "coreArea",
        label: "Área núcleo",
        placeholder: "Ex: tecnologia orgânica, músicas autorais, gestão de comunidades.",
      },
      {
        key: "topics",
        label: "Tópicos que domina",
        placeholder: "Ex: guitarras, IA aplicada à escrita, produtividade criativa.",
      },
    ],
  },
  {
    title: "3) Tom & Estilo de escrita",
    description: "Defina se quer textos longos/curtos, mais diretos ou narrativos, e o quanto de humor/opinião eles podem ter.",
    fields: [
      { key: "toneStyle", label: "Como escrever?", placeholder: "Ex: direto, reflexivo, técnico, pessoal." },
      { key: "lengthPreference", label: "Comprimento preferido", placeholder: "Ex: parágrafos curtos, resumos de conclusão." },
      { key: "objectivity", label: "Objetividade vs narratividade", placeholder: "Ex: equilíbrio entre facts e experiências." },
      { key: "opinionDegree", label: "Opinião da IA", placeholder: "Ex: permitir opinião moderada, sem exageros." },
      { key: "humorLevel", label: "Humor", placeholder: "1 (sério) a 5 (leve e brincalhão)" },
    ],
  },
  {
    title: "4) Personalidade e marca",
    description: "Liste valores, emoções e referências estilísticas que devem permear o texto.",
    fields: [
      { key: "values", label: "Valores", placeholder: "Ex: honestidade, clareza, experimentação." },
      { key: "emotions", label: "Emoções que deseja transmitir", placeholder: "Ex: curiosidade, tranquilidade, motivação." },
      { key: "references", label: "Referências de estilo", placeholder: "Ex: Akita, Naval Ravikant, Austin Kleon." },
    ],
  },
  {
    title: "5) Hobbies & interesses",
    description: "Indique hobbies ou histórias que podem aparecer nos textos.",
    fields: [
      { key: "hobbies", label: "Hobbies", placeholder: "Ex: música, jogos, caminhadas, livros." },
      {
        key: "stories",
        label: "Histórias pessoais",
        placeholder: "Ex: ensaios da banda, experiências profissionais, aprendizados recentes.",
      },
    ],
  },
  {
    title: "6) O que evitar",
    description: "Informe palavras, posturas ou temas sensíveis a serem bloqueados.",
    fields: [
      { key: "avoidStatements", label: "Conteúdos proibidos", placeholder: "Ex: palavrões, exageros, advogados." },
      { key: "avoidStance", label: "Postura a evitar", placeholder: "Ex: arrogância, formalidade excessiva." },
      { key: "sensitiveTopics", label: "Temas sensíveis", placeholder: "Ex: política partidária, conselhos médicos." },
    ],
  },
  {
    title: "7) Preferências de estrutura",
    description: "Defina aberturas, fechamentos e o ritmo dos parágrafos.",
    fields: [
      { key: "opening", label: "Abertura", placeholder: "Ex: conto contexto pessoal antes de puxar tema." },
      { key: "closing", label: "Fechamento", placeholder: "Ex: convite à reflexão ou call to action suave." },
      { key: "paragraphStyle", label: "Parágrafos", placeholder: "Ex: curtos, cada ideia no próprio parágrafo." },
      { key: "teachingFocus", label: "Foco didático", placeholder: "Ex: sempre entregar um pequeno ensinamento." },
    ],
  },
  {
    title: "8) Objetivo do blog",
    description: "Para quem você escreve e qual o propósito da publicação?",
    fields: [
      { key: "audience", label: "Público", placeholder: "Ex: apenas para mim, colegas técnicos e comunidade." },
      { key: "intention", label: "Intenção", placeholder: "Ex: expressar ideias, registrar aprendizados." },
      { key: "goal", label: "Meta", placeholder: "Ex: inspirar ou gerar discussões." },
      { key: "focus", label: "Foco temático principal", placeholder: "Ex: tecnologia, música ou filosofia." },
    ],
  },
];

const alignmentKeys = fieldGroups.flatMap((group) => group.fields.map((field) => field.key));

export default function AiAlignmentPage() {
  const [profile, setProfile] = useState<UserProfile | null | undefined>();
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [alignment, setAlignment] = useState<Record<string, string>>(
    alignmentKeys.reduce((acc, key) => ({ ...acc, [key]: "" }), {}),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      try {
        const result = await api.getProfile();
        if (isMounted) {
          setProfile(result);
          setDisplayName(result?.displayName ?? "");
          setSlug(result?.slug ?? "");
          setShortDescription(result?.shortDescription ?? "");
          if (result?.alignment) {
            setAlignment((prev) => ({
              ...prev,
              ...result.alignment,
            }));
          }
        }
      } catch {
        if (isMounted) {
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const missingProfile = !profile;
  const fieldsDisabled = loading;

  const handleAlignmentChange = (key: string, value: string) => {
    setAlignment((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setStatus(null);
    try {
      if (!displayName.trim() || !slug.trim() || !shortDescription.trim()) {
        throw new Error("Preencha nome, slug e descrição rápida antes de salvar.");
      }
      const updated = await api.updateProfile({
        displayName: displayName.trim(),
        slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
        shortDescription: shortDescription.trim(),
        alignment,
      });
      setProfile(updated);
      setStatus({ message: "Alinhamento salvo com sucesso.", tone: "success" });
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Falha ao salvar o alinhamento.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-10 text-slate-100 sm:px-8 lg:px-16">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-col gap-3 rounded-3xl border border-slate-900 bg-slate-900/70 p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Alinhamento da IA</p>
            <h1 className="text-3xl font-semibold text-white">Explique seu universo criativo</h1>
          </div>
          <p className="text-sm text-slate-300">
            Essas respostas moldam a instrução padrão que guia a IA, definem o slug público e orientam toda criação de
            conteúdo.
          </p>
          {missingProfile && (
            <p className="text-xs text-amber-300">
              Ainda não há nome/slug/descritivo? Complete os campos abaixo antes de salvar.
            </p>
          )}
        </header>

        <section className="rounded-3xl border border-slate-900 bg-slate-900/70 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Identidade básica</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Nome que aparece nas publicações
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                disabled={fieldsDisabled}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Slug público
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                disabled={fieldsDisabled}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              Como se descreve em poucas palavras?
              <textarea
                value={shortDescription}
                onChange={(event) => setShortDescription(event.target.value)}
                rows={2}
                disabled={fieldsDisabled}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
              />
            </label>
          </div>
        </section>

        <form className="space-y-6">
          {fieldGroups.map((group) => (
            <section key={group.title} className="rounded-3xl border border-slate-900 bg-slate-900/50 p-6">
              <header className="mb-4 flex flex-col gap-1">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{group.title}</p>
                <p className="text-sm text-slate-400">{group.description}</p>
              </header>
              <div className="space-y-4">
                {group.fields.map((field) => (
                  <label key={field.key} className="flex flex-col gap-2 text-sm text-slate-300">
                    {field.label}
                    <textarea
                      value={alignment[field.key] ?? ""}
                      onChange={(event) => handleAlignmentChange(field.key, event.target.value)}
                      rows={3}
                      className="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
                      placeholder={field.placeholder}
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}
        </form>

        {status && (
          <p className={`text-sm ${status.tone === "success" ? "text-emerald-300" : "text-rose-400"}`}>
            {status.message}
          </p>
        )}

        <div className="flex justify-end">
          <button
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-2xl bg-emerald-400 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar alinhamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
