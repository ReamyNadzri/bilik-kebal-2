import Image from "next/image";
import type { ReactNode } from "react";
import { COOKIE_SUMMARY, CookieNotice } from "./cookie-notice";
import { MobileTabBar } from "./mobile-tab-bar";
import { ShotLink } from "./motion/gunshot-transition";
import { PageSwipe } from "./page-swipe";
import { ShellBackButton } from "./shell-back-button";
import { ShellHeader, ShellMenu, ShellMenuProvider, ShellMenuToggle } from "./shell-menu";
import { ShellNav } from "./shell-nav";
import { ThemeMusicProvider, ThemeMusicToggle } from "./theme-music";
import { POST_WANTED_NAV, type NavItem, type NavItemId } from "@/features/presentation/navigation";

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
  /**
   * The compact header's account controls (Inbox and avatar, or Sign in),
   * shown below 1200 px in place of `accountMenu`. A slot for the same reason.
   */
  compactAccount?: ReactNode;
  /** The account block at the foot of the compact menu. A slot likewise. */
  menuAccount?: ReactNode;
}

/**
 * Application frame: skip link, timber rail, main landmark, footer.
 *
 * The frame is a Server Component; the navigation, the header's scroll and
 * menu state, and the theme music toggle hydrate — the music lives here so the
 * root layout keeps it playing across navigation.
 *
 * Three layouts, chosen in CSS so the server renders each correctly
 * (design_handoff_vaultix_mobile):
 * - From 1200 px, the full rail: destinations, title search, account, and
 *   the one prominent action.
 * - Below 1200 px, one compact row — back, wordmark, account shortcuts and a
 *   Menu toggle — whose drop-down panel carries the destinations, the search
 *   and the account block. Tablets keep "Post a Wanted" in the row.
 * - Below 720 px, a bottom tab bar as well, sideways page swipes, and no
 *   footer.
 *
 * Content is written on paper laid over the timber
 * (docs/superpowers/specs/2026-09-16-vaultix-frontier-visual-handoff.md).
 * `app-shell__sheet` is that paper for every screen that does not compose
 * its own panels; a page that does marks its root `page-bare`.
 */
export function AppShell({
  accountMenu,
  children,
  compactAccount,
  currentNavId,
  menuAccount,
  roleNav = [],
  unreadCount = null,
}: AppShellProps) {
  return (
    <ThemeMusicProvider>
      <ShellMenuProvider>
        <div className="app-shell">
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>

          <ShellHeader>
            <div className="app-shell__bar">
              <ShellBackButton />

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
                <span className="app-shell__wordmark-text">VAULTIX</span>
              </ShotLink>

              <ShellNav currentNavId={currentNavId} roleNav={roleNav} unreadCount={unreadCount} />

              <div className="app-shell__account">
                <ThemeMusicToggle />
                {accountMenu}
              </div>

              <div className="shell-compact">
                {compactAccount}
                <ShotLink
                  className="shell-compact__post shell-compact__tablet"
                  href={POST_WANTED_NAV.href}
                  prefetch={false}
                >
                  {POST_WANTED_NAV.label}
                </ShotLink>
                <ShellMenuToggle />
              </div>
            </div>

            <ShellMenu account={menuAccount} currentNavId={currentNavId} roleNav={roleNav} />
          </ShellHeader>

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
                VAULTIX is an academic resource bounty marketplace for Malaysian university
                students. A Sheriff reviews every claim before anyone gains access or is paid.
              </p>
              <p className="app-shell__footer-cookies">
                <strong>Cookies.</strong> {COOKIE_SUMMARY}
              </p>
              {process.env.NODE_ENV === "production" ? null : (
                <p className="app-shell__dev-marker">
                  Development build. Screens marked &ldquo;Development only&rdquo; show fixture
                  data.
                </p>
              )}
            </div>
          </footer>

          <CookieNotice />
          <MobileTabBar currentNavId={currentNavId} />
          <PageSwipe />
        </div>
      </ShellMenuProvider>
    </ThemeMusicProvider>
  );
}
