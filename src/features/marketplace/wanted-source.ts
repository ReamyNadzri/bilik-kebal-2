import { applyBoardFilters } from "./filters";
import { FIXTURE_NOW, WANTED, findWantedDetail } from "./fixtures";
import type { BoardFilters, MarketplaceResult, WantedDetail, WantedSummary } from "./types";

/**
 * The replaceable seam between marketplace screens and their data.
 *
 * Phase 3 has published no Wanted operations, so every read here answers from
 * `fixtures.ts`. Screens import this module and nothing below it: when Codex
 * publishes the reads listed in §14 of
 * `docs/superpowers/specs/2026-09-14-vaultix-marketplace-visual-direction.md`,
 * the bodies change and no component does.
 *
 * No Supabase client, no `fetch`, and no policy decision lives here. Whether a
 * viewer may browse, transact or claim is decided by the identity module and
 * enforced server-side and by RLS; this module only supplies metadata to
 * render.
 */

/**
 * States a fixture-backed screen cannot otherwise reach.
 *
 * A fixture never fails and is never empty, so the unavailable and empty
 * presentations would be unreachable in a browser and unreviewable. A
 * development-only query parameter makes them inspectable.
 *
 * Deliberately gated on `NODE_ENV`: in a production build the comparison is
 * statically false and the branch is removed, so no deployed page can be
 * pushed into a fake failure by a crafted URL.
 */
export type PreviewState = "unavailable" | "empty";

export function readPreviewState(raw: string | readonly string[] | undefined): PreviewState | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const value = Array.isArray(raw) ? raw[0] : raw;

  return value === "unavailable" || value === "empty" ? value : null;
}

/** The reference instant relative times are measured against. */
export function marketplaceNow(): string {
  return FIXTURE_NOW;
}

/**
 * The Wanteds the homepage shows above the fold.
 *
 * Newest first and open to claims, because the homepage is an invitation to
 * take part rather than an archive: a closed bounty is the least useful thing
 * a first-time visitor could be shown.
 */
export function listFeaturedWanted(
  preview: PreviewState | null = null,
  limit = 4,
): MarketplaceResult<readonly WantedSummary[]> {
  if (preview === "unavailable") {
    return { status: "unavailable" };
  }

  if (preview === "empty") {
    return { status: "ready", data: [] };
  }

  const open = WANTED.filter((wanted) => wanted.status !== "closed");

  return { status: "ready", data: open.slice(0, limit) };
}

/**
 * The filtered, sorted Board.
 *
 * The filtering happens in `filters.ts` because a fixture has to do here what
 * the Board read will do on the server. When that read arrives, the filters go
 * with the request and this function forwards them instead.
 */
export function listWanted(
  filters: BoardFilters,
  preview: PreviewState | null = null,
): MarketplaceResult<readonly WantedSummary[]> {
  if (preview === "unavailable") {
    return { status: "unavailable" };
  }

  const source = preview === "empty" ? [] : WANTED;

  return { status: "ready", data: applyBoardFilters(source, filters, FIXTURE_NOW) };
}

/** How many Wanteds exist before any filter is applied. */
export function countAllWanted(preview: PreviewState | null = null): number {
  return preview === "empty" ? 0 : WANTED.length;
}

/**
 * One Wanted in full.
 *
 * `null` means no request has that public identifier, which the page turns
 * into a 404 rather than an error: a mistyped address is not a failure of the
 * marketplace.
 */
export function readWanted(
  id: string,
  preview: PreviewState | null = null,
): MarketplaceResult<WantedDetail | null> {
  if (preview === "unavailable") {
    return { status: "unavailable" };
  }

  return { status: "ready", data: findWantedDetail(id) };
}

/** The Wanteds suggested beside a request, resolved from their identifiers. */
export function readSimilarWanted(detail: WantedDetail): readonly WantedSummary[] {
  return detail.similarIds
    .map((id) => WANTED.find((wanted) => wanted.id === id))
    .filter((wanted): wanted is WantedSummary => wanted !== undefined);
}
