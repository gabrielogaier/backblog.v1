"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { ApiError } from "@/lib/api";
import PublicHeader from "@/components/PublicHeader";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccountsId = {
  initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
  cancel: () => void;
};

type GoogleWindow = Window & {
  google?: {
    accounts?: {
      id?: GoogleAccountsId;
    };
  };
};

export default function LoginPage() {
  const googleClientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
  const { login, loginWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [accountJustVerified, setAccountJustVerified] = useState(false);

  useEffect(() => {
    if (googleScriptReady || !googleClientId || typeof window === "undefined") {
      return;
    }

    const hasGoogleApi = Boolean((window as GoogleWindow).google?.accounts?.id);
    if (hasGoogleApi) {
      setGoogleScriptReady(true);
      return;
    }

    const intervalId = window.setInterval(() => {
      const ready = Boolean((window as GoogleWindow).google?.accounts?.id);
      if (ready) {
        setGoogleScriptReady(true);
        window.clearInterval(intervalId);
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [googleClientId, googleScriptReady]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const emailFromQuery = params.get("email");
    const verifiedFlag = params.get("verified") === "1";

    if (verifiedFlag) {
      setAccountJustVerified(true);
    }

    if (!email && emailFromQuery) {
      setEmail(emailFromQuery);
    }
  }, [email]);

  const handleGoogleSignIn = useCallback(
    async (credential: string) => {
      setError(null);
      setErrorCode(null);
      setGoogleSubmitting(true);
      try {
        await loginWithGoogle(credential);
      } catch (err) {
        const apiError = err as ApiError;
        setErrorCode(apiError?.code ?? null);
        setError(apiError instanceof Error ? apiError.message : "Não foi possível autenticar com Google.");
      } finally {
        setGoogleSubmitting(false);
      }
    },
    [loginWithGoogle],
  );

  useEffect(() => {
    if (!googleClientId || !googleScriptReady || !googleButtonRef.current) {
      return;
    }

    const googleApi = (window as GoogleWindow).google?.accounts?.id;
    if (!googleApi) {
      return;
    }

    googleButtonRef.current.innerHTML = "";

    googleApi.initialize({
      client_id: googleClientId,
      callback: (response) => {
        const credential = response?.credential;
        if (!credential) {
          setError("Não foi possível autenticar com Google.");
          return;
        }
        void handleGoogleSignIn(credential);
      },
    });

    googleApi.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      width: 320,
    });

    return () => {
      try {
        googleApi.cancel();
      } catch {
        // Sem ação adicional.
      }
    };
  }, [googleClientId, googleScriptReady, handleGoogleSignIn]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setErrorCode(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      const apiError = err as ApiError;
      setErrorCode(apiError?.code ?? null);
      setError(apiError instanceof Error ? apiError.message : "Erro ao autenticar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <PublicHeader />
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGoogleScriptReady(true)}
        onReady={() => setGoogleScriptReady(true)}
      />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-3xl border border-slate-900 bg-slate-900/70 p-6 shadow-2xl shadow-slate-900/40">
          <h1 className="text-center text-2xl font-semibold tracking-tight text-white">Bem-vindo de volta 👋</h1>
          <p className="mt-1 text-center text-sm text-slate-400">Acesse o painel do Backblog</p>
          {accountJustVerified ? (
            <p className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
              E-mail verificado com sucesso. Agora é só entrar com sua senha.
            </p>
          ) : null}

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
            {errorCode === "EMAIL_NOT_VERIFIED" ? (
              <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                Sua conta ainda não foi verificada. Finalize a verificação de e-mail para continuar.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || loading || googleSubmitting}
              className="mt-2 rounded-2xl bg-emerald-400 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-400/40 transition hover:bg-emerald-300 disabled:opacity-50"
            >
              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-800" />
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">ou</span>
            <span className="h-px flex-1 bg-slate-800" />
          </div>

          {googleClientId ? (
            <div className="flex min-h-[44px] justify-center">
              <div ref={googleButtonRef} />
            </div>
          ) : (
            <p className="text-center text-xs text-slate-500">
              Login com Google indisponível. Defina `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
