"use client";

import { usePathname } from "next/navigation";
import { ShotLink } from "./motion/gunshot-transition";
import { useIntentPrefetch } from "./shell-nav";
import {
  MARKETPLACE_NAV,
  POST_WANTED_NAV,
  activeNavId,
  type NavItem,
  type NavItemId,
} from "@/features/presentation/navigation";

/** Short labels for a fifth of a phone's width; the destinations are the rail's. */
const TAB_LABELS: Partial<Record<NavItemId, string>> = {
  board: "Board",
  map: "Map",
  claims: "Hunt",
  archive: "Archive",
};

function tab(id: NavItemId): NavItem {
  const item = MARKETPLACE_NAV.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`No marketplace destination "${id}"`);
  return { ...item, label: TAB_LABELS[id] ?? item.label };
}

const LEFT_TABS = [tab("board"), tab("map")] as const;
const RIGHT_TABS = [tab("claims"), tab("archive")] as const;

export interface MobileTabBarProps {
  /** As on the rail: `undefined` works it out from the path, `null` marks none. */
  readonly currentNavId?: NavItemId | null | undefined;
}

/**
 * The phone's bottom tab bar (design_handoff_vaultix_mobile, §2): Board, Map,
 * a raised Post button, Hunt and Archive, within a thumb's reach.
 *
 * Displayed below 720 px only, in CSS, so the server renders it for every
 * width and no layout waits on script. Every tab is a link, so it works before
 * hydration; the current one is marked by a brass bar and a tint as well as
 * `aria-current`, never by colour alone.
 */
export function MobileTabBar({ currentNavId }: MobileTabBarProps) {
  const pathname = usePathname() ?? "";
  const current = currentNavId === undefined ? activeNavId(pathname) : currentNavId;
  const postIntentPrefetch = useIntentPrefetch(POST_WANTED_NAV.href);

  return (
    <>
      <nav className="mobile-tab-bar" aria-label="Quick">
        <ul className="mobile-tab-bar__list">
          {LEFT_TABS.map((item) => (
            <Tab key={item.id} item={item} current={current === item.id} />
          ))}
          <li className="mobile-tab-bar__post-slot">
            <ShotLink
              href={POST_WANTED_NAV.href}
              {...postIntentPrefetch}
              className="mobile-tab-bar__post"
              aria-label={POST_WANTED_NAV.label}
              aria-current={current === POST_WANTED_NAV.id ? "page" : undefined}
            >
              <span className="mobile-tab-bar__plus" aria-hidden="true">
                +
              </span>
              <span aria-hidden="true">Post</span>
            </ShotLink>
          </li>
          {RIGHT_TABS.map((item) => (
            <Tab key={item.id} item={item} current={current === item.id} />
          ))}
        </ul>
      </nav>
      {/* Keeps the end of every page clear of the fixed bar. */}
      <div className="mobile-tab-bar__spacer" aria-hidden="true" />
    </>
  );
}

function Tab({ item, current }: { readonly item: NavItem; readonly current: boolean }) {
  const intentPrefetch = useIntentPrefetch(item.href);

  return (
    <li>
      <ShotLink
        href={item.href}
        {...intentPrefetch}
        className="mobile-tab-bar__tab"
        aria-current={current ? "page" : undefined}
      >
        <span className="mobile-tab-bar__mark" aria-hidden="true" />
        <span>{item.label}</span>
      </ShotLink>
    </li>
  );
}
