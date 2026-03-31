"use client";

import { useEffect, useState } from "react";
import { getUserStats, type PublicUserStats } from "@/lib/publicApi";
import AnimatedSubtext from "@/components/AnimatedSubtext";
import PublicHeader from "@/components/PublicHeader";

export default function HomeLandingPage() {
  const [userStats, setUserStats] = useState<PublicUserStats | null>(null);
  const [accountDeletedToast, setAccountDeletedToast] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchStats() {
      try {
        const stats = await getUserStats();
        if (isMounted) {
          setUserStats(stats);
        }
      } catch (error) {
        console.error("Não foi possível carregar as estatísticas públicas", error);
      }
    }

    fetchStats();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    if (typeof window !== "undefined") {
      const flag = sessionStorage.getItem("backblog.accountDeleted");
      if (flag) {
        setAccountDeletedToast(true);
        sessionStorage.removeItem("backblog.accountDeleted");
        timeoutId = setTimeout(() => setAccountDeletedToast(false), 8000);
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const totalUsersDisplay = userStats ? userStats.totalUsers.toLocaleString("pt-BR") : "--";
  const onlineUsersDisplay = userStats ? userStats.onlineUsers.toLocaleString("pt-BR") : "--";
  const onlineStatusLabel = userStats
    ? userStats.onlineUsers === 1
      ? "1 pessoa online agora"
      : `${onlineUsersDisplay} pessoas online agora`
    : "Monitorando atividade...";

  const handleSubmit = () => {
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <PublicHeader />
      {accountDeletedToast ? (
        <div className="mx-auto mt-4 w-full max-w-4xl px-6">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 shadow-lg shadow-emerald-500/20">
            <p className="font-semibold text-emerald-200">Conta excluída com sucesso</p>
            <p className="text-emerald-100/90">
              Todos os seus dados foram removidos permanentemente do Backblog. Obrigado por ter feito parte desta jornada.
            </p>
          </div>
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 sm:px-10">
        <section className="space-y-8 rounded-3xl border border-slate-900 bg-slate-900/70 p-8 text-center">
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold leading-snug text-white sm:text-4xl">Escreva. Organize. Evolua.</h1>
            <AnimatedSubtext />
          </div>
          <button
            onClick={handleSubmit}
            className="h-12 rounded-2xl bg-emerald-400 px-8 text-sm font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:bg-emerald-300"
          >
            Comece agora. É grátis!
          </button>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 shadow-lg shadow-emerald-500/5">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
              <div className="text-center sm:text-left">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Comunidade</p>
                <p className="text-sm text-slate-300">Pessoas escrevendo agora. Junte-se a elas.</p>
              </div>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-3xl font-semibold text-white">{totalUsersDisplay}</p>
                  <p className="text-xs text-slate-500">Usuários cadastrados</p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-slate-950/80 px-5 py-4">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50 opacity-75" />
                    <span
                      className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                      aria-hidden="true"
                    />
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">{onlineUsersDisplay}</p>
                    <p className="text-xs text-slate-500">{onlineStatusLabel}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
