import type { Metadata } from "next";
import { Karla, Rye, Silkscreen } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

/*
 * The three families from the approved visual handoff
 * (docs/superpowers/specs/2026-09-16-vaultix-frontier-visual-handoff.md §3).
 *
 * `next/font` downloads them at build time and serves them from this
 * deployment, so a page that shows money never waits on a third-party font
 * host. Each exposes a variable only; which role a family plays is decided by
 * the semantic tokens in globals.css, never here.
 */
const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-karla",
  display: "swap",
});

const rye = Rye({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-rye",
  display: "swap",
});

const silkscreen = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-silkscreen",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VAULTIX",
  description: "Academic resource bounties for verified communities.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${karla.variable} ${rye.variable} ${silkscreen.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
