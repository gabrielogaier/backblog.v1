"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import PublicHeader from "@/components/PublicHeader";

export default function LoginPage() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-3xl border border-slate-900 bg-slate-900/70 p-6 shadow-2xl shadow-slate-900/40">
          <h1 className="text-center text-2xl font-semibold tracking-tight text-white">Bem-vindo de volta 👋</h1>
          <p className="mt-1 text-center text-sm text-slate-400">Acesse o painel do Backblog</p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <label className="text-sm text-slate-300">
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-base text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
              />
            </label>

            <label className="text-sm text-slate-300">
              Senha
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-base text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
              />
            </label>

            {error ? <p className="text-sm text-rose-400">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting || loading}
              className="mt-2 rounded-2xl bg-emerald-400 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-400/40 transition hover:bg-emerald-300 disabled:opacity-50"
            >
              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
