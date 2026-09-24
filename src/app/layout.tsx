import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/account-menu";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/features/presentation/auth/auth-provider";
import { readAccount } from "@/features/presentation/auth/require-account";
import { SHERIFF_CONSOLE_NAV } from "@/features/presentation/navigation";
import { countUnreadNotifications } from "@/modules/notifications/loaders/unread-count";
import "./globals.css";

export const metadata: Metadata = {
  title: "VAULTIX",
  description: "Academic resource bounties for verified communities.",
};

/**
 * The shell names the signed-in account on every screen, so every screen is
 * rendered per request and never enters a shared cache
 * (context/code-standards.md). Every route below already reads the caller's
 * session, so this costs no page its caching.
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const outcome = await readAccount();
  const account = outcome.kind === "account" ? outcome.account : null;

  /**
   * A convenience destination, never a control. The console enforces role and
   * institution scope server-side and through RLS on every operation it
   * offers; hiding this link is not access control
   * (context/architecture.md).
   */
  const roleNav = account?.console.hasAccess === true ? [SHERIFF_CONSOLE_NAV] : [];
  const unreadCount = account ? await countUnreadNotifications() : null;

  return (
    <html lang="en">
      <body>
        <AuthProvider initialAccount={account}>
          <AppShell roleNav={roleNav} accountMenu={<AccountMenu />} unreadCount={unreadCount}>
            {children}
          </AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
