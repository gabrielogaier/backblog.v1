"use client";

import Script from "next/script";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestRegisterCode, verifyRegisterCode, type ApiError, type RegisterPayload } from "@/lib/publicApi";
import { useAuth } from "@/contexts/AuthContext";

type FormState = RegisterPayload;
type SignupStep = "request" | "verify";
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

const initialForm: FormState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
};

export default function SignupPage() {
  const googleClientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [step, setStep] = useState<SignupStep>("request");
  const [verificationCode, setVerificationCode] = useState("");
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

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

  const formIsValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  const handleChange =
    <T extends keyof FormState>(field: T) =>
    (value: FormState[T]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    };

  const validateForm = (state: FormState) => {
    const validationErrors: Partial<Record<keyof FormState, string>> = {};

    if (!state.name.trim()) {
      validationErrors.name = "Informe seu nome.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) {
      validationErrors.email = "Informe um e-mail válido.";
    }
    if (state.password.length < 8) {
      validationErrors.password = "A senha precisa ter no mínimo 8 caracteres.";
    }
    if (state.confirmPassword !== state.password) {
      validationErrors.confirmPassword = "As senhas devem ser iguais.";
    }
    if (!state.acceptTerms) {
      validationErrors.acceptTerms = "Aceite os termos para continuar.";
    }

    return validationErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setInfoMessage(null);

    if (step === "request") {
      const validationErrors = validateForm(form);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setSubmitting(true);
      try {
        const response = await requestRegisterCode(form);
        setStep("verify");
        setInfoMessage(
          response?.message || "Código de verificação enviado para seu e-mail. Digite abaixo para finalizar o cadastro.",
        );
      } catch (error) {
        const apiError = error as ApiError;
        const message = apiError?.message ?? "Não foi possível enviar o código de verificação.";
        setServerError(message);
        if (apiError?.status === 409) {
          setErrors((prev) => ({ ...prev, email: message }));
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setServerError("Informe o código de verificação com 6 dígitos.");
      return;
    }

    setSubmitting(true);
    try {
      await verifyRegisterCode({
        email: form.email,
        code: verificationCode.trim(),
      });
      router.push(`/login?email=${encodeURIComponent(form.email)}&verified=1`);
    } catch (error) {
      const apiError = error as ApiError;
      const message = apiError?.message ?? "Não foi possível verificar o código.";
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = useCallback(
    async (credential: string) => {
      setServerError(null);
      setInfoMessage(null);
      setGoogleSubmitting(true);
      try {
        await loginWithGoogle(credential);
      } catch (error) {
        const apiError = error as ApiError;
        setServerError(apiError?.message ?? "Não foi possível autenticar com Google.");
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
          setServerError("Não foi possível autenticar com Google.");
          return;
        }
        void handleGoogleSignIn(credential);
      },
    });

    googleApi.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      text: "signup_with",
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

  const handleResendCode = async () => {
    setServerError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const response = await requestRegisterCode(form);
      setInfoMessage(response?.message || "Código reenviado para seu e-mail.");
    } catch (error) {
      const apiError = error as ApiError;
      setServerError(apiError?.message ?? "Não foi possível reenviar o código.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 px-4 py-10">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGoogleScriptReady(true)}
        onReady={() => setGoogleScriptReady(true)}
      />
      <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-900 bg-slate-900/70 p-8 shadow-2xl shadow-slate-900/40">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Crie sua conta no Backblog</h1>
          <p className="text-sm text-slate-400">Leva menos de um minuto. Depois é só começar a escrever seus pensamentos.</p>
        </div>

        {step === "request" ? (
          <>
            <div className="mt-8">
              {googleClientId ? (
                <div className="flex min-h-[44px] justify-center">
                  <div ref={googleButtonRef} />
                </div>
              ) : (
                <p className="text-center text-xs text-slate-500">
                  Cadastro com Google indisponível. Defina `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
                </p>
              )}
            </div>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-800" />
              <span className="text-xs uppercase tracking-[0.2em] text-slate-500">ou cadastre com e-mail</span>
              <span className="h-px flex-1 bg-slate-800" />
            </div>
          </>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-200">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => handleChange("name")(event.target.value)}
              placeholder="Como você quer ser chamado(a)"
              autoComplete="name"
              disabled={step === "verify" || submitting}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-base text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
            />
            <p className="mt-2 text-xs text-slate-500">
              Pode ser só o primeiro nome ou apelido. Útil para personalizar a experiência depois.
            </p>
            {errors.name ? <p className="mt-1 text-xs text-rose-400">{errors.name}</p> : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => handleChange("email")(event.target.value)}
              placeholder="seunome@exemplo.com"
              autoComplete="email"
              disabled={step === "verify" || submitting}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-base text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
            />
            {errors.email ? <p className="mt-1 text-xs text-rose-400">{errors.email}</p> : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200">Senha</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => handleChange("password")(event.target.value)}
              placeholder="Crie uma senha"
              autoComplete="new-password"
              disabled={step === "verify" || submitting}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-base text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
            />
            <p className="mt-2 text-xs text-slate-500">Mínimo de 8 caracteres. Use letras e números para maior segurança.</p>
            {errors.password ? <p className="mt-1 text-xs text-rose-400">{errors.password}</p> : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200">Confirmar senha</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => handleChange("confirmPassword")(event.target.value)}
              placeholder="Repita a sua senha"
              autoComplete="new-password"
              disabled={step === "verify" || submitting}
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-base text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
            />
            {errors.confirmPassword ? <p className="mt-1 text-xs text-rose-400">{errors.confirmPassword}</p> : null}
          </div>

          <div>
            <label className="flex items-start gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={form.acceptTerms}
                onChange={(event) => handleChange("acceptTerms")(event.target.checked)}
                disabled={step === "verify" || submitting}
                className="mt-1 h-5 w-5 rounded border border-slate-700 bg-slate-900 text-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
              />
              <span>
                Aceito os{" "}
                <Link href="/termos" className="text-emerald-300 hover:text-emerald-200">
                  termos de uso
                </Link>{" "}
                e a{" "}
                <Link href="/privacidade" className="text-emerald-300 hover:text-emerald-200">
                  política de privacidade
                </Link>
                .
              </span>
            </label>
            {errors.acceptTerms ? <p className="mt-1 text-xs text-rose-400">{errors.acceptTerms}</p> : null}
          </div>

          {step === "verify" ? (
            <div>
              <label className="block text-sm font-medium text-slate-200">Código de verificação</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-base tracking-[0.24em] text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
              />
              <p className="mt-2 text-xs text-slate-500">
                Enviamos um código para <span className="font-medium text-slate-300">{form.email}</span>.
              </p>
            </div>
          ) : null}

          {infoMessage ? <p className="text-sm text-emerald-300">{infoMessage}</p> : null}
          {serverError ? <p className="text-sm text-rose-400">{serverError}</p> : null}

          <button
            type="submit"
            disabled={submitting || googleSubmitting || (step === "request" && !formIsValid)}
            className="rounded-2xl bg-emerald-400 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-400/40 transition hover:bg-emerald-300 disabled:opacity-50"
          >
            {submitting
              ? step === "request"
                ? "Enviando código..."
                : "Validando código..."
              : step === "request"
                ? "Enviar código de verificação"
                : "Confirmar código e criar conta"}
          </button>

          {step === "verify" ? (
            <button
              type="button"
              disabled={submitting || googleSubmitting}
              onClick={handleResendCode}
              className="rounded-2xl border border-slate-700 py-3 text-base font-medium text-slate-200 transition hover:border-slate-500 disabled:opacity-50"
            >
              Reenviar código
            </button>
          ) : null}
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Já tem uma conta?{" "}
          <Link href="/login" className="text-emerald-300 hover:text-emerald-200">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
