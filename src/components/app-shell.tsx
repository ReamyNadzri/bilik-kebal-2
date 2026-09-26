import Image from "next/image";
import type { ReactNode } from "react";
import { ShotLink } from "./motion/gunshot-transition";
import { ShellNav } from "./shell-nav";
import type { NavItem, NavItemId } from "@/features/presentation/navigation";

export interface AppShellProps {
  children: ReactNode;
  /**
   * Overrides the route-derived current destination. The navigation works out
   * the active item from the path on its own; this exists so a test or a
   * server-rendered preview can state it directly.
   */
  currentNavId?: NavItemId | null;
  /**
   * Extra destinations the viewer's role grants, supplied by the view model.
   * The shell renders what it is given and decides no permission itself.
   */
  roleNav?: readonly NavItem[];
  /** Unread notification count for the rail badge; null hides it. */
  unreadCount?: number | null;
  /**
   * The signed-in identity and the way out of it.
   *
   * A slot rather than a direct dependency, for the same reason `roleNav` is
   * one: the shell stays a presentational Server Component that decides
   * nothing about who is looking at it, and it stays renderable in a test
   * without standing up a session.
   */
  accountMenu?: ReactNode;
}

/**
 * Application frame: skip link, timber rail, main landmark, footer.
 *
 * The frame is a Server Component; only the navigation hydrates, because
 * marking the current destination needs the path. At 360 px the rail stacks
 * into bands rather than collapsing behind a disclosure button, so the shell
 * still needs no JavaScript to be usable.
 *
 * Content is written on paper laid over the timber
 * (docs/superpowers/specs/2026-09-16-vaultix-frontier-visual-handoff.md).
 * `app-shell__sheet` is that paper for every screen that does not compose
 * its own panels; a page that does marks its root `page-bare`.
 */
export function AppShell({
  accountMenu,
  children,
  currentNavId,
  roleNav = [],
  unreadCount = null,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="app-shell__header">
        <div className="app-shell__bar">
          {/* Not prefetched on sight: the homepage has no loading state to buy. */}
          <ShotLink className="app-shell__wordmark" href="/" prefetch={false}>
            <Image
              className="app-shell__logo"
              src="/brand/logo-tile.webp"
              alt=""
              width={40}
              height={40}
              priority
              unoptimized
            />
            VAULTIX
          </ShotLink>

          <ShellNav currentNavId={currentNavId} roleNav={roleNav} unreadCount={unreadCount} />

          {accountMenu === undefined ? null : (
            <div className="app-shell__account">{accountMenu}</div>
          )}
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="app-shell__main">
        <div className="app-shell__sheet">{children}</div>
      </main>

      <footer className="app-shell__footer">
        <div className="app-shell__footer-inner">
          <div className="app-shell__footer-brand">
            <Image
              className="app-shell__logo"
              src="/brand/logo-tile.webp"
              alt=""
              width={44}
              height={44}
              unoptimized
            />
            <div>
              <p className="app-shell__footer-name">VAULTIX</p>
              <p className="app-shell__footer-motto">Knowledge worth sharing</p>
            </div>
          </div>
          <p className="app-shell__footer-line">
            VAULTIX is an academic resource bounty marketplace for Malaysian university students. A
            Sheriff reviews every claim before anyone gains access or is paid.
          </p>
          {process.env.NODE_ENV === "production" ? null : (
            <p className="app-shell__dev-marker">
              Development build. Screens marked &ldquo;Development only&rdquo; show fixture data.
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
