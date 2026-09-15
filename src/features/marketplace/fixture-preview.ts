import { FIXTURE_NOW } from "./fixtures";

/**
 * Development-only affordances for the surfaces that are still fixture-backed.
 *
 * Only `/claims` (Phase 4 Claims and moderation) and the `/wanted/new/preview`
 * harness use this module. `/`, `/board` and `/wanted/[id]` read the published
 * public Wanted operations and reach their unavailable and empty states for
 * real, so they need none of it.
 *
 * Delete this module when `/claims` gets its own read contract.
 */

/**
 * States a fixture-backed screen cannot otherwise reach.
 *
 * A fixture never fails and is never empty, so the unavailable and empty
 * presentations would be unreachable in a browser and unreviewable. A
 * development-only query parameter makes them inspectable.
 */
export type PreviewState = "unavailable" | "empty";

/**
 * Deliberately gated on `NODE_ENV`: in a production build the comparison is
 * statically false and the branch is removed, so no deployed page can be
 * pushed into a fake failure by a crafted URL.
 */
export function readPreviewState(raw: string | readonly string[] | undefined): PreviewState | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const value = Array.isArray(raw) ? raw[0] : (raw as string | undefined);

  return value === "unavailable" || value === "empty" ? value : null;
}

/**
 * The instant a fixture-backed screen measures relative times against.
 *
 * Fixed rather than a clock read: fixture data must render identically twice,
 * and a wall-clock read would produce one string on the server and another in
 * the browser on exactly the elements that carry deadlines.
 */
export function fixtureNow(): string {
  return FIXTURE_NOW;
}
