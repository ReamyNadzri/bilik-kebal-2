import Link from "next/link";
import type { ReactNode } from "react";
import { PRIMARY_NAV, type NavItemId } from "@/features/presentation/navigation";

export interface AppShellProps {
  children: ReactNode;
  currentNavId?: NavItemId;
}

/**
 * Application frame: skip link, primary navigation, main landmark, footer.
 *
 * Deliberately a Server Component. The provisional navigation wraps instead of
 * collapsing into a disclosure menu, so the shell needs no JavaScript to stay
 * usable at 360 px. Introduce a client disclosure only when the navigation
 * outgrows a single row.
 */
export function AppShell({ children, currentNavId }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="app-shell__header">
        <span className="app-shell__wordmark">VAULTIX</span>

        <nav aria-label="Primary" className="app-shell__nav">
          <ul className="app-shell__nav-list">
            {PRIMARY_NAV.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="app-shell__nav-link"
                  aria-current={currentNavId === item.id ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className="app-shell__main">
        {children}
      </main>

      <footer className="app-shell__footer">
        <p>Provisional interface. Final visual design pending external handoff.</p>
      </footer>
    </div>
  );
}
