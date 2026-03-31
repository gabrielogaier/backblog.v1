"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ProtectedView } from "@/components/ProtectedView";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { AuthProvider } from "@/contexts/AuthContext";

const DEFAULT_BACK = { href: "/admin", label: "Painel" };

function resolveTopBar(pathname: string | null): { href?: string; label?: string } {
  if (!pathname) {
    return {};
  }

  if (pathname === "/admin") {
    return {};
  }

  if (pathname.startsWith("/admin/posts/")) {
    return { href: "/admin/posts", label: "Posts" };
  }

  if (pathname === "/admin/posts") {
    return DEFAULT_BACK;
  }

  if (pathname === "/admin/settings") {
    return DEFAULT_BACK;
  }

  if (pathname === "/admin/alinhamento") {
    return DEFAULT_BACK;
  }

  return DEFAULT_BACK;
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const backConfig = useMemo(() => resolveTopBar(pathname), [pathname]);

  return (
    <AuthProvider>
      <ProtectedView>
        <div className="min-h-screen bg-slate-950 text-white">
          <DashboardTopBar backHref={backConfig.href} backLabel={backConfig.label} />
          <div className="pt-6">{children}</div>
        </div>
      </ProtectedView>
    </AuthProvider>
  );
}
