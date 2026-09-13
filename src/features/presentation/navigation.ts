/**
 * Primary navigation is presentation data only.
 *
 * Visibility, permissions and role scoping are decided by backend view models
 * (see docs/superpowers/plans/2026-09-13-vaultix-mvp-coordination.md, §3).
 * This module must never encode a business rule.
 */

export type NavItemId = "board" | "claims" | "archive" | "notifications" | "profile";

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
