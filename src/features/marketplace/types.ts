import type { WantedDetail, WantedSummary } from "@/contracts/marketplace";

/**
 * Presentation types the marketplace screens need that no contract owns.
 *
 * `WantedSummary`, `WantedDetail`, the lifecycle union, `Sen` and every
 * operation-result shape belong to `src/contracts/marketplace.ts` and are
 * re-exported here rather than restated, so a field the backend adds reaches
 * the components without a second definition drifting behind it.
 *
 * What remains below is genuinely the frontend's: the Board's URL state, and
 * the Hunter view models for `/claims`, which is still Phase 4 fixture work
 * with no published contract to consume.
 *
 * Nothing here may carry a storage path, bucket, object key, checksum, file
 * name, evidence reference or personal datum. A Wanted is metadata about a
 * request; the file behind a claim is never described to a browser before a
 * Sheriff has approved it (`context/architecture.md`).
 */

export type { WantedDetail, WantedSummary };

/** Where a Wanted sits in its lifecycle, as the contract presents it. */
export type WantedStatus = WantedSummary["status"];

/** The shape the Board's filter selects need from any catalogue option. */
export interface TaxonomyOption {
  readonly id: string;
  readonly label: string;
}

/** What a Hunter must be before they may claim a given Wanted. */
export type HuntEligibility = "institution-verified" | "faculty-match-preferred";

export interface HuntOpportunity extends WantedSummary {
  /**
   * How many claims are already competing. A count only — a Hunter must never
   * learn who else submitted, or anything about their files.
   */
  readonly activeClaimCount: number;
  readonly eligibility: HuntEligibility;
}

/**
 * The eight claim states a Hunter can be in.
 *
 * `not-selected` and `rejected` are deliberately separate and must never be
 * presented as one (`context/ui-context.md`, Status Language). A not-selected
 * claim was valid; another claim won the bounty. A rejected claim breached the
 * content policy.
 */
export type ClaimStatus =
  | "draft"
  | "screening"
  | "needs-information"
  | "under-review"
  | "not-selected"
  | "approved"
  | "rejected"
  | "quarantined";

export interface ClaimSummary {
  readonly id: string;
  readonly wantedId: string;
  readonly wantedTitle: string;
  readonly courseCode: string;
  readonly courseName: string;
  readonly status: ClaimStatus;
  /** Absent while the claim is still a draft. */
  readonly submittedAt: string | null;
}

/** Sort orders the Board offers. Each maps to a URL value, then to a contract value. */
export type BoardSort = "newest" | "highest-bounty" | "ending-soon";

/**
 * The lifecycle states the Board may filter by.
 *
 * Narrower than `WantedStatus`: `ending-soon`, `well-funded` and `closed` are
 * presentations the server derives, not filters the published query accepts.
 */
export type BoardStatus = "open" | "reviewing";

export interface BoardFilters {
  readonly query: string;
  readonly campusId: string | null;
  readonly courseId: string | null;
  readonly resourceTypeId: string | null;
  readonly sessionId: string | null;
  readonly status: BoardStatus | null;
  readonly sort: BoardSort;
}

/**
 * What a marketplace read can answer.
 *
 * `unavailable` is a real outcome, not a fixture convenience: a Board read that
 * cannot reach its source must say so rather than render an empty Board, which
 * a reader would misread as "nobody needs anything".
 */
export type MarketplaceResult<T> =
  | { readonly status: "ready"; readonly data: T }
  | {
      readonly status: "unavailable";
    };
