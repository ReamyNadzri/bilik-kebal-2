"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { ShotLink } from "./motion/gunshot-transition";
import { NotificationMenu } from "./notification-menu";
import { PixelIcon, type PixelIconName } from "./pixel-icon";
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
  /** Unread notifications; the badge shows only above zero. */
  readonly unreadCount?: number | null | undefined;
}

/** Account utilities carry a small icon; the word always travels with it. */
const ACCOUNT_ICONS: Partial<Record<NavItemId, PixelIconName>> = {
  notifications: "bell",
  profile: "person",
};

/**
 * Prefetches a rail destination when the reader shows intent — a pointer on
 * it, a touch, or keyboard focus — instead of whenever it is on screen.
 *
 * Every screen is rendered per request, so a prefetch buys a destination's
 * route and loading state, never its data. On sight, that was a server request
 * for every rail link on every page load; on intent, it is one for the link the
 * reader is about to use, which keeps its loading state instant.
 */
function useIntentPrefetch(href: string) {
  const router = useRouter();
  const prefetch = useCallback(() => router.prefetch(href), [router, href]);

  // Spread onto the link: Next's own prefetch-on-sight is switched off.
  return {
    prefetch: false,
    onFocus: prefetch,
    onMouseEnter: prefetch,
    onTouchStart: prefetch,
  } as const;
}

function NavLink({
  item,
  current,
  badge = null,
  shot = false,
}: {
  readonly item: NavItem;
  readonly current: boolean;
  readonly badge?: number | null;
  /** Primary destinations travel with the gunshot transition; account utilities do not. */
  readonly shot?: boolean;
}) {
  const icon = ACCOUNT_ICONS[item.id];
  const Anchor = shot ? ShotLink : Link;
  const intentPrefetch = useIntentPrefetch(item.href);

  return (
    <li>
      <Anchor
        href={item.href}
        {...intentPrefetch}
        className="shell-nav__link"
        aria-current={current ? "page" : undefined}
      >
        {icon === undefined ? null : <PixelIcon name={icon} className="shell-nav__icon" />}
        <span className={icon === undefined ? undefined : "shell-nav__link-text--secondary"}>
          {item.label}
        </span>
        {badge !== null && badge > 0 ? (
          <span className="shell-nav__badge">
            <span aria-hidden="true">{badge > 99 ? "99+" : badge}</span>
            <span className="visually-hidden">{`, ${badge} unread`}</span>
          </span>
        ) : null}
      </Anchor>
    </li>
  );
}

/**
 * The rail's two navigation landmarks, a title search and the one prominent
 * action.
 *
 * A Client Component solely to read the path: marking the current destination
 * is the only thing here that needs the browser. Everything it renders is
 * links and a `GET` form, so it works before hydration and continues to work
 * if hydration never happens — the active mark is the only thing lost.
 *
 * Marketplace destinations and account utilities are separate `nav` elements
 * with their own labels. The hierarchy is therefore real for a screen-reader
 * user cycling landmarks, not just visible to a sighted one.
 *
 * The search asks the Board, whose published read matches request titles
 * only, so it is labelled as a title search and promises nothing more.
 *
 * A role destination appearing here is a convenience. The console enforces
 * role and institution scope server-side and through RLS; hiding a link is not
 * access control (context/architecture.md).
 */
export function ShellNav({ currentNavId, roleNav = [], unreadCount = null }: ShellNavProps) {
  const pathname = usePathname();
  const current = currentNavId === undefined ? activeNavId(pathname ?? "") : currentNavId;
  const postIntentPrefetch = useIntentPrefetch(POST_WANTED_NAV.href);

  return (
    <div className="shell-nav">
      <nav aria-label="Primary" className="shell-nav__primary">
        <ul className="shell-nav__list">
          {[...MARKETPLACE_NAV, ...roleNav].map((item) => (
            <NavLink key={item.id} item={item} current={current === item.id} shot />
          ))}
        </ul>
      </nav>

      <form className="shell-nav__search" action="/board" method="get" role="search">
        <PixelIcon name="search" className="shell-nav__icon" />
        <label className="visually-hidden" htmlFor="shell-search">
          Quick search by request title
        </label>
        <input
          className="shell-nav__search-input"
          id="shell-search"
          name="q"
          type="search"
          placeholder="Search request titles"
        />
      </form>

      <nav aria-label="Account" className="shell-nav__account">
        <ul className="shell-nav__list">
          {ACCOUNT_NAV.map((item) =>
            // Signed in, the bell opens the latest notifications in place.
            // Signed out (no count), it stays a link that leads to sign-in.
            item.id === "notifications" && unreadCount !== null ? (
              <NotificationMenu
                key={item.id}
                unreadCount={unreadCount}
                current={current === item.id}
              />
            ) : (
              <NavLink
                key={item.id}
                item={item}
                current={current === item.id}
                badge={item.id === "notifications" ? unreadCount : null}
              />
            ),
          )}
        </ul>
      </nav>

      <ShotLink
        href={POST_WANTED_NAV.href}
        {...postIntentPrefetch}
        className="button button--primary shell-nav__post"
        aria-current={current === POST_WANTED_NAV.id ? "page" : undefined}
      >
        {POST_WANTED_NAV.label}
      </ShotLink>
    </div>
  );
}
