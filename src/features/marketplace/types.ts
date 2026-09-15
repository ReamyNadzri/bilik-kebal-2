import type { Sen } from "./money";

/**
 * Frontend view models for the Wanted marketplace.
 *
 * These are presentation shapes, not database rows and not a fork of a Codex
 * contract — Phase 3 has published none yet. Section 14 of
 * `docs/superpowers/specs/2026-09-14-vaultix-marketplace-visual-direction.md`
 * records the reads that must replace them. When those arrive, this file is
 * deleted and the components consume the contract types directly.
 *
 * Nothing here may carry a storage path, bucket, object key, checksum, file
 * name, evidence reference or personal datum. A Wanted is metadata about a
 * request; the file behind a claim is never described to a browser before a
 * Sheriff has approved it (`context/architecture.md`).
 */

/** Where a Wanted sits in its lifecycle, as a reader needs to understand it. */
export type WantedStatus = "open" | "ending-soon" | "well-funded" | "reviewing" | "closed";

export interface TaxonomyOption {
  readonly id: string;
  readonly label: string;
}

export interface WantedSummary {
  /** Opaque public identifier. Never an internal row id. */
  readonly id: string;
  readonly title: string;
  readonly courseCode: string;
  readonly courseName: string;
  readonly courseId: string;
  readonly campus: string;
  readonly campusId: string;
  readonly resourceType: string;
  readonly resourceTypeId: string;
  readonly session: string;
  readonly sessionId: string;
  /** Gross bounty in integer sen. Presentation formats it; nothing computes on it. */
  readonly grossBountySen: Sen;
  readonly backerCount: number;
  readonly status: WantedStatus;
  readonly postedAt: string;
  readonly closesAt: string;
}

export interface WantedActivityEvent {
  readonly id: string;
  readonly at: string;
  readonly summary: string;
}

/**
 * How a Commissioner's trustworthiness is presented.
 *
 * A display name and two verification states, and nothing else. No email, no
 * matric number, no institution evidence, no contact route.
 */
export interface CommissionerPresentation {
  readonly displayName: string;
  readonly emailVerified: boolean;
  readonly institutionVerified: boolean;
}

export interface WantedDetail extends WantedSummary {
  readonly description: string;
  readonly faculty: string;
  readonly programme: string;
  readonly language: string;
  readonly tags: readonly string[];
  readonly commissioner: CommissionerPresentation;
  /**
   * The platform fee rate snapshotted when this Wanted was published, in basis
   * points. Snapshotting is an invariant (`context/architecture.md`), so the
   * rate travels with the Wanted rather than being read from configuration at
   * display time.
   */
  readonly feeRateBasisPoints: number;
  readonly policyVersion: string;
  readonly activity: readonly WantedActivityEvent[];
  /** Public ids of Wanteds a reader should check before funding this one. */
  readonly similarIds: readonly string[];
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

/** Sort orders the Board offers. Each maps to a URL value. */
export type BoardSort = "newest" | "highest-bounty" | "ending-soon";

export interface BoardFilters {
  readonly query: string;
  readonly campusId: string | null;
  readonly courseId: string | null;
  readonly resourceTypeId: string | null;
  readonly sessionId: string | null;
  readonly status: WantedStatus | null;
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
