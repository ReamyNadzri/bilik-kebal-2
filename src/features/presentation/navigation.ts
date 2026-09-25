/**
 * Navigation is presentation data only.
 *
 * Visibility, permissions and role scoping are decided by backend view models
 * (see docs/superpowers/plans/2026-09-13-vaultix-mvp-coordination.md, §3).
 * This module must never encode a business rule.
 */

export type NavItemId =
  "board" | "map" | "claims" | "archive" | "notifications" | "profile" | "console" | "post";

export interface NavItem {
  readonly id: NavItemId;
  readonly label: string;
  readonly href: string;
}

/**
 * The marketplace itself: what a student came here to do.
 *
 * Separated from the account utilities below because VAULTIX is a marketplace
 * first and an account second. The separation is structural — two navigation
 * landmarks — rather than a difference in font size, so it is as clear to a
 * screen reader as it is on screen.
 */
export const MARKETPLACE_NAV: readonly NavItem[] = [
  { id: "board", label: "Wanted Board", href: "/board" },
  { id: "map", label: "Explore Map", href: "/map" },
  { id: "claims", label: "Hunt", href: "/claims" },
  { id: "archive", label: "Archive", href: "/archive" },
] as const;

/** Account utilities. Secondary to the marketplace, never hidden from it. */
export const ACCOUNT_NAV: readonly NavItem[] = [
  { id: "notifications", label: "Notifications", href: "/notifications" },
] as const;

/**
 * The one prominent action in the shell.
 *
 * Publishing a Wanted needs institution verification and a funded first
 * contribution, so the destination explains the requirement rather than
 * opening a form the viewer may not be allowed to submit. The rule itself is
 * enforced server-side; this link is signposting, not a gate.
 */
export const POST_WANTED_NAV: NavItem = {
  id: "post",
  label: "Post a Wanted",
  href: "/wanted/new",
};

/**
 * Shown only when the viewer's role grants it, as decided by the backend.
 *
 * Whether this appears is a convenience, never a control: the console and its
 * operations enforce role and institution scope server-side and through RLS.
 * Hiding the link is not access control (context/architecture.md).
 */
export const SHERIFF_CONSOLE_NAV: NavItem = {
  id: "console",
  label: "Sheriff Console",
  href: "/console",
};

/**
 * Which navigation item a path belongs to.
 *
 * Matches the section rather than the exact path, so a Wanted detail page
 * still marks the Wanted Board as current. `/` belongs to no item: the
 * wordmark is the route home, and marking a marketplace destination current on
 * the homepage would be a lie.
 */
export function activeNavId(pathname: string): NavItemId | null {
  if (pathname === "/wanted/new") {
    return "post";
  }

  if (pathname === "/board" || pathname.startsWith("/wanted/")) {
    return "board";
  }

  if (pathname.startsWith("/map")) {
    return "map";
  }

  if (pathname.startsWith("/claims")) {
    return "claims";
  }

  if (pathname.startsWith("/archive")) {
    return "archive";
  }

  if (pathname.startsWith("/notifications")) {
    return "notifications";
  }

  if (pathname.startsWith("/profile")) {
    return "profile";
  }

  if (pathname.startsWith("/console")) {
    return "console";
  }

  return null;
}
