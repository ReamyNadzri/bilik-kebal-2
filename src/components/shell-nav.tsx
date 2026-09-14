"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ACCOUNT_NAV,
  MARKETPLACE_NAV,
  POST_WANTED_NAV,
  activeNavId,
  type NavItem,
  type NavItemId,
} from "@/features/presentation/navigation";

export interface ShellNavProps {
  /**
   * `undefined` means "work it out from the path"; `null` means "no
   * destination is current". Spelled out because `exactOptionalPropertyTypes`
   * treats an absent property and an explicit `undefined` as different things,
   * and the shell forwards whatever it was given.
   */
  readonly currentNavId?: NavItemId | null | undefined;
  readonly roleNav?: readonly NavItem[] | undefined;
}

function NavLink({ item, current }: { readonly item: NavItem; readonly current: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        className="shell-nav__link"
        aria-current={current ? "page" : undefined}
      >
        {item.label}
      </Link>
    </li>
  );
}

/**
 * The shell's two navigation landmarks and the one prominent action.
 *
 * A Client Component solely to read the path: marking the current destination
 * is the only thing here that needs the browser. Everything it renders is
 * links, so it works before hydration and continues to work if hydration never
 * happens — the active mark is the only thing lost.
 *
 * Marketplace destinations and account utilities are separate `nav` elements
 * with their own labels. The hierarchy is therefore real for a screen-reader
 * user cycling landmarks, not just visible to a sighted one.
 *
 * A role destination appearing here is a convenience. The console enforces
 * role and institution scope server-side and through RLS; hiding a link is not
 * access control (context/architecture.md).
 */
export function ShellNav({ currentNavId, roleNav = [] }: ShellNavProps) {
  const pathname = usePathname();
  const current = currentNavId === undefined ? activeNavId(pathname ?? "") : currentNavId;

  return (
    <div className="shell-nav">
      <nav aria-label="Primary" className="shell-nav__primary">
        <ul className="shell-nav__list">
          {[...MARKETPLACE_NAV, ...roleNav].map((item) => (
            <NavLink key={item.id} item={item} current={current === item.id} />
          ))}
        </ul>
      </nav>

      <nav aria-label="Account" className="shell-nav__account">
        <ul className="shell-nav__list">
          {ACCOUNT_NAV.map((item) => (
            <NavLink key={item.id} item={item} current={current === item.id} />
          ))}
        </ul>
      </nav>

      <Link
        href={POST_WANTED_NAV.href}
        className="button button--primary shell-nav__post"
        aria-current={current === POST_WANTED_NAV.id ? "page" : undefined}
      >
        {POST_WANTED_NAV.label}
      </Link>
    </div>
  );
}
