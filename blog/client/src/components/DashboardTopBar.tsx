"use client";

import Link from "next/link";
import { useAuthOptional } from "@/contexts/AuthContext";

type DashboardTopBarProps = {
  backHref?: string;
  backLabel?: string;
};

export function DashboardTopBar({ backHref, backLabel = "Voltar" }: DashboardTopBarProps) {
  const auth = useAuthOptional();
  const aiUsage = auth?.aiUsage ?? null;

  const aiUsageLabel = aiUsage
    ? aiUsage.reachedLimit
      ? "IA hoje: limite atingido"
      : `IA hoje: ${aiUsage.remaining} de ${aiUsage.limit} restantes`
    : null;

  return (
    <div className="sticky top-0 z-20 border-b border-slate-900 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center px-4 py-3">
        <div className="min-w-[120px]">
          {backHref ? (
            <Link
              href={backHref}
              className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:text-emerald-300"
            >
              ← {backLabel}
            </Link>
          ) : null}
        </div>
        <p className="flex-1 text-center text-sm font-semibold uppercase tracking-[0.4em] text-white">Backblog</p>
        <div className="min-w-[120px] text-right">
          {aiUsageLabel ? (
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{aiUsageLabel}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
