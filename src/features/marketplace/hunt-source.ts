import { CLAIMS, HUNTS } from "./fixtures";
import type { PreviewState } from "./wanted-source";
import type { ClaimSummary, HuntOpportunity, MarketplaceResult } from "./types";

/**
 * Replaceable Phase 3 read seam for the Hunter workspace.
 *
 * The backend contract does not exist yet. Until it does, these reads are
 * deterministic fixtures and the route carries `FixtureNotice`. No permission
 * is inferred here and no write operation is simulated.
 */
export function listHunts(
  preview: PreviewState | null = null,
): MarketplaceResult<readonly HuntOpportunity[]> {
  if (preview === "unavailable") {
    return { status: "unavailable" };
  }

  return { status: "ready", data: preview === "empty" ? [] : HUNTS };
}

export function listClaims(
  preview: PreviewState | null = null,
): MarketplaceResult<readonly ClaimSummary[]> {
  if (preview === "unavailable") {
    return { status: "unavailable" };
  }

  return { status: "ready", data: preview === "empty" ? [] : CLAIMS };
}
