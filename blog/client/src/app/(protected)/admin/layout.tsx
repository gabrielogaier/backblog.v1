import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Painel",
    template: "%s | Painel Backblog",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
