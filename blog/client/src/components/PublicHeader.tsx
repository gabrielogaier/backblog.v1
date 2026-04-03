"use client";

import { useState } from "react";
import Link from "next/link";

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between border-b border-slate-900 bg-slate-950/80 px-6 py-4">
        <Link href="/" className="flex items-center gap-3 text-xl font-semibold tracking-wide text-white">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400 bg-emerald-500/10 text-2xl">
            B
          </span>
          Backblog
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 sm:flex">
            <Link
              className="rounded-full border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-400"
              href="/signup"
            >
              Sign up
            </Link>
            <Link
              className="rounded-full border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-400"
              href="/sobre"
            >
              Sobre
            </Link>
            <Link
              className="rounded-full border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-300 hover:border-emerald-300"
              href="/doar"
            >
              Doar
            </Link>
            <Link
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              href="/login"
            >
              Login
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-800 text-emerald-300 hover:border-emerald-400 sm:hidden"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>
      {menuOpen ? (
        <div className="border-b border-slate-900 bg-slate-950/90 px-6 pb-4 pt-2 sm:hidden">
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-900 p-3">
            <Link
              className="rounded-2xl border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-400"
              href="/signup"
              onClick={() => setMenuOpen(false)}
            >
              Sign up
            </Link>
            <Link
              className="rounded-2xl border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-400"
              href="/sobre"
              onClick={() => setMenuOpen(false)}
            >
              Sobre
            </Link>
            <Link
              className="rounded-2xl border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-300 hover:border-emerald-300"
              href="/doar"
              onClick={() => setMenuOpen(false)}
            >
              Doar
            </Link>
            <Link
              className="rounded-2xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              href="/login"
              onClick={() => setMenuOpen(false)}
            >
              Login
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
