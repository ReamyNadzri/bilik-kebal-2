import type {
  ListWantedQuery,
  MarketplaceOperationCode,
  WantedDetail,
  WantedSummary,
} from "@/contracts/marketplace";
import { listPublicWanted, readPublicWanted } from "@/modules/wanted/loaders/wanted-operations";

/**
 * The seam between marketplace screens and the published public read
 * operations.
 *
 * Screens import this module and nothing below it. It calls the Codex-owned
 * server loaders directly rather than fetching the application's own
 * `GET /api/marketplace/wanted` routes: a server component asking its own HTTP
 * route for data needs an absolute origin and hand-forwarded cookies to reach
 * the same function it could have called, and the route handlers are two-line
 * delegations to exactly these loaders.
 *
 * No Supabase client, no policy decision and no filtering lives here. Who may
 * browse is decided by the read service and enforced again by RLS; which rows
 * match a filter is decided by the server. This module only turns operation
 * codes into the states a screen knows how to render, and it never lets a
 * failure message through — those are written for logs, not for readers.
 */

/**
 * What a public marketplace read can answer.
 *
 * `signed-out` and `email-unverified` are trust states with their own remedy,
 * `not-found` is a mistyped or withdrawn address rather than a failure, and
 * `unavailable` is ours to fix. A successful empty result is `ready` with
 * nothing in it, never `unavailable`: a Board that says "nobody needs
 * anything" when the read failed would be a lie.
 */
export type MarketplaceRead<T> =
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "signed-out" }
  | { readonly status: "email-unverified" }
  | { readonly status: "not-found" }
  | { readonly status: "unavailable" };

type Refusal = Exclude<MarketplaceRead<never>, { status: "ready" }>;

/**
 * Every other code — `VALIDATION_ERROR` from a hand-edited query included — is
 * unavailable rather than a state of its own: the reader cannot act on the
 * difference, and naming it would leak how the request was rejected.
 */
function refusal(code: MarketplaceOperationCode): Refusal {
  switch (code) {
    case "AUTH_REQUIRED":
      return { status: "signed-out" };
    case "EMAIL_NOT_VERIFIED":
      return { status: "email-unverified" };
    case "WANTED_NOT_FOUND":
      return { status: "not-found" };
    default:
      return { status: "unavailable" };
  }
}

/**
 * The operations answer with a result rather than throwing, but a screen must
 * degrade rather than fail if one ever does: a 500 tells the reader nothing and
 * loses the rest of the page with it. The reason belongs in server logs.
 */
async function read<T>(operation: () => Promise<{ ok: boolean }>): Promise<MarketplaceRead<T>> {
  try {
    const result = (await operation()) as
      { ok: true; data: T } | { ok: false; code: MarketplaceOperationCode };

    return result.ok ? { status: "ready", data: result.data } : refusal(result.code);
  } catch {
    return { status: "unavailable" };
  }
}

/** The filtered, sorted Board, exactly as the operation returned it. */
export function listWanted(
  query: ListWantedQuery,
): Promise<MarketplaceRead<readonly WantedSummary[]>> {
  return read(() => listPublicWanted(query));
}

/**
 * The Wanteds the homepage shows above the fold.
 *
 * Newest first, and only a handful: the homepage is an invitation to take part
 * rather than an archive. The order is the server's, not re-decided here.
 */
export async function listFeaturedWanted(
  limit = 4,
): Promise<MarketplaceRead<readonly WantedSummary[]>> {
  const result = await listWanted({ sort: "newest" });

  return result.status === "ready"
    ? { status: "ready", data: result.data.slice(0, limit) }
    : result;
}

/**
 * One Wanted, by its opaque public identifier.
 *
 * `not-found` is kept distinct from `unavailable` so the page can answer a
 * mistyped address with a real 404 instead of telling the reader something
 * broke.
 */
export function readWanted(publicId: string): Promise<MarketplaceRead<WantedDetail>> {
  return read(() => readPublicWanted(publicId));
}

/**
 * The Wanteds suggested beside a request, resolved from their public
 * identifiers.
 *
 * Capped, because this runs per detail view. An identifier that no longer
 * resolves is dropped rather than failing the page: a suggestion that has
 * since closed is not a reason to refuse the request the reader asked for.
 */
export async function readSimilarWanted(
  detail: WantedDetail,
  limit = 4,
): Promise<readonly WantedSummary[]> {
  const results = await Promise.all(detail.similarIds.slice(0, limit).map((id) => readWanted(id)));

  return results.flatMap((result) => (result.status === "ready" ? [result.data] : []));
}

/**
 * The instant relative times on a screen are measured against.
 *
 * Read once per render on the server and passed down, so every "closes in"
 * on a page is measured from the same moment and no component reads a clock
 * of its own.
 */
export function marketplaceNow(): string {
  return new Date().toISOString();
}
