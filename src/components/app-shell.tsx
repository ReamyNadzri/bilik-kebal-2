import Link from "next/link";
import type { ReactNode } from "react";
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
}

/**
 * Application frame: skip link, navigation, main landmark, footer.
 *
 * The frame is a Server Component; only the navigation hydrates, because
 * marking the current destination needs the path. The layout at 360 px stacks
 * into bands rather than collapsing behind a disclosure button, so the shell
 * still needs no JavaScript to be usable.
 *
 * `main` is the parchment sheet the whole product is written on
 * (docs/superpowers/specs/2026-09-14-vaultix-marketplace-visual-direction.md
 * §2.1). Every screen, including the Identity screens built before this
 * direction existed, inherits the theme by sitting inside it.
 */
export function AppShell({ children, currentNavId, roleNav = [] }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="app-shell__header">
        <Link className="app-shell__wordmark" href="/">
          VAULTIX
          <span className="app-shell__wordmark-rule" aria-hidden="true" />
        </Link>

        <ShellNav currentNavId={currentNavId} roleNav={roleNav} />
      </header>

      <main id="main-content" tabIndex={-1} className="app-shell__main">
        <div className="app-shell__sheet">{children}</div>
      </main>

      <footer className="app-shell__footer">
        <p className="app-shell__footer-line">
          VAULTIX is an academic resource bounty marketplace for Malaysian university students. A
          Sheriff reviews every claim before anyone gains access or is paid.
        </p>
        {process.env.NODE_ENV === "production" ? null : (
          <p className="app-shell__dev-marker">
            Development build. Visual design is provisional and pending the external handoff.
          </p>
        )}
      </footer>
    </div>
  );
}
