"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser, type ApiError, type RegisterPayload } from "@/lib/publicApi";

type FormState = RegisterPayload;

const initialForm: FormState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      await registerUser(form);
      router.push(`/login?email=${encodeURIComponent(form.email)}`);
    } catch (error) {
      const apiError = error as ApiError;
      const message = apiError?.message ?? "Não foi possível criar sua conta.";
      setServerError(message);
      if (apiError?.status === 409) {
        setErrors((prev) => ({ ...prev, email: message }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-900 bg-slate-900/70 p-8 shadow-2xl shadow-slate-900/40">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Crie sua conta no Backblog</h1>
          <p className="text-sm text-slate-400">Leva menos de um minuto. Depois é só começar a escrever seus pensamentos.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-200">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => handleChange("name")(event.target.value)}
              placeholder="Como você quer ser chamado(a)"
              autoComplete="name"
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

          {serverError ? <p className="text-sm text-rose-400">{serverError}</p> : null}

          <button
            type="submit"
            disabled={submitting || !formIsValid}
            className="rounded-2xl bg-emerald-400 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-400/40 transition hover:bg-emerald-300 disabled:opacity-50"
          >
            {submitting ? "Criando conta..." : "Criar conta"}
          </button>
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
