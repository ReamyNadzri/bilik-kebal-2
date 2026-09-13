/**
 * Primary navigation is presentation data only.
 *
 * Visibility, permissions and role scoping are decided by backend view models
 * (see docs/superpowers/plans/2026-09-13-vaultix-mvp-coordination.md, §3).
 * This module must never encode a business rule.
 */

export type NavItemId = "board" | "claims" | "archive" | "notifications" | "profile" | "console";

export interface NavItem {
  readonly id: NavItemId;
  readonly label: string;
  readonly href: string;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { id: "board", label: "Wanted Board", href: "/board" },
  { id: "claims", label: "Hunt", href: "/claims" },
  { id: "archive", label: "Archive", href: "/archive" },
  { id: "notifications", label: "Notifications", href: "/notifications" },
  { id: "profile", label: "Profile", href: "/profile" },
] as const;

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
