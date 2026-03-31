"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { User } from "@/types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
  bootstrapSession = true,
}: {
  children: React.ReactNode;
  bootstrapSession?: boolean;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const refreshAbortRef = useRef<AbortController | null>(null);
  const logoutInProgressRef = useRef(false);

  const refresh = useCallback(async () => {
    if (logoutInProgressRef.current) {
      setLoading(false);
      return;
    }

    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    setLoading(true);
    try {
      const data = await api.me({ signal: controller.signal });
      setUser(data.user);
    } catch {
      if (!controller.signal.aborted) {
        setUser(null);
      }
    } finally {
      if (refreshAbortRef.current === controller) {
        refreshAbortRef.current = null;
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!bootstrapSession) {
      setLoading(false);
      return;
    }
    refresh();
  }, [bootstrapSession, refresh]);

  useEffect(() => {
    return () => {
      refreshAbortRef.current?.abort();
      refreshAbortRef.current = null;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      await api.login(email, password);
      await refresh();
      router.push("/admin");
    },
    [refresh, router],
  );

  const logout = useCallback(async () => {
    logoutInProgressRef.current = true;
    refreshAbortRef.current?.abort();
    refreshAbortRef.current = null;
    try {
      await api.logout();
    } finally {
      setUser(null);
      setLoading(false);
      router.push("/login");
      logoutInProgressRef.current = false;
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh,
      login,
      logout,
    }),
    [user, loading, refresh, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
}
