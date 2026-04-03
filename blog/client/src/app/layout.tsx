import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "Backblog",
    template: "%s | Backblog",
  },
  description: "CMS pessoal otimizado para mobile com suporte a IA.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/icon-192.png", sizes: "192x192" },
  ],
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-slate-950 text-white antialiased`}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
