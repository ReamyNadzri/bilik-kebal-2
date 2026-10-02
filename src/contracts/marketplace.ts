import type { WantedPicture } from "./wanted-pictures";
import { z } from "zod";
import type { OperationResult } from "./operation-result";
import type { MemberBadge } from "./console";

export type Sen = number & { readonly __brand: "Sen" };
/** How long a request stays open: any whole number of days from 3 to 30. */
export type WantedDurationDays = number;
export const WANTED_DURATION_MIN_DAYS = 3;
export const WANTED_DURATION_MAX_DAYS = 30;
/**
 * What a Wanted asks for. Academic requests take file claims; missing items and
 * discussions take text replies. Any kind may carry a bounty or be free.
 */
export type WantedKind = "academic" | "missing_item" | "discussion";
export const wantedKinds = ["academic", "missing_item", "discussion"] as const;

/**
 * The posting terms version every new Wanted snapshots. Bumped whenever the
 * terms text in `src/features/legal/terms.ts` changes.
 */
export const CURRENT_POLICY_VERSION = "2026-10-02";
export type WantedLifecycle = "draft" | "awaiting_payment" | "open" | "reviewing" | "expired";

export type MarketplaceOperationCode =
  | "AUTH_REQUIRED"
  | "EMAIL_NOT_VERIFIED"
  | "INSTITUTION_VERIFICATION_REQUIRED"
  | "ACCOUNT_RESTRICTED"
  | "NOT_AUTHORIZED"
  | "VALIDATION_ERROR"
  | "WANTED_NOT_FOUND"
  | "DRAFT_NOT_FOUND"
  | "DRAFT_NOT_EDITABLE"
  | "DUPLICATE_CHECK_REQUIRED"
  | "DUPLICATE_CHECK_EXPIRED"
  | "PAYMENT_DISABLED"
  | "PAYMENT_UNAVAILABLE"
  | "AMOUNT_OUT_OF_RANGE"
  | "REGION_CLOSED"
  | "FREE_LIMIT_REACHED"
  | "WANTED_LOCKED"
  | "MARKETPLACE_UNAVAILABLE";

const uuid = z.uuid();
/** The shortest description a Wanted may have (user, 2 October 2026). */
export const DESCRIPTION_MIN_LENGTH = 10;

const authoredText = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);
const durationDaysSchema = z.number().int().min(3).max(30);

export const senSchema = z
  .number()
  .int()
  .safe()
  .nonnegative()
  .transform((value) => value as Sen);

/**
 * A course (subject) code as a member types it: 3 to 12 capital letters and
 * digits, starting with a letter, for example CSC510. Lower case is refused,
 * not converted (migration 202610150003).
 */
export const COURSE_CODE_PATTERN = /^[A-Z][A-Z0-9]{2,11}$/;

export const wantedDraftInputSchema = z.object({
  campusId: uuid,
  facultyId: uuid,
  programmeId: uuid,
  /** Typed by the member; the server reuses or files the course it names. */
  courseCode: z.string().trim().regex(COURSE_CODE_PATTERN),
  /** Optional: a request may cover any session. */
  academicSessionId: z
    .union([uuid, z.literal("")])
    .nullish()
    .transform((value) => value || null),
  resourceTypeId: uuid,
  languageId: uuid,
  tagIds: z
    .array(uuid)
    .max(5)
    .refine((ids) => new Set(ids).size === ids.length),
  title: authoredText(8, 120),
  description: authoredText(DESCRIPTION_MIN_LENGTH, 2000),
  durationDays: durationDaysSchema,
  policyAccepted: z.literal(true),
});

export type WantedDraftInput = z.input<typeof wantedDraftInputSchema>;
export type ValidatedWantedDraftInput = z.output<typeof wantedDraftInputSchema>;

export const duplicateSuggestionInputSchema = z.object({
  draftId: uuid,
});

export type SuggestWantedDuplicatesInput = z.input<typeof duplicateSuggestionInputSchema>;

export const publicationInputSchema = z.object({
  draftId: uuid,
  duplicateCheckToken: z.string().trim().min(32).max(512),
  initialContributionSen: z
    .number()
    .int()
    .safe()
    .min(100)
    .max(5000)
    .transform((value) => value as Sen),
});

export type PrepareWantedPublicationInput = z.input<typeof publicationInputSchema>;

/** Opens an academic draft with no bounty: no payment step and no fee. */
export const freePublicationInputSchema = z.object({
  draftId: uuid,
  duplicateCheckToken: z.string().trim().min(32).max(512),
});

export type PublishFreeWantedInput = z.input<typeof freePublicationInputSchema>;

/**
 * A missing-item or discussion Wanted. A free one opens in one step and uses
 * one of the member's free requests; a paid one needs a first contribution of
 * RM1 to RM50, so it waits for the payment step like a paid academic request.
 */
export const communityWantedInputSchema = z
  .object({
    kind: z.enum(["missing_item", "discussion"]),
    campusId: uuid,
    title: authoredText(8, 120),
    description: authoredText(DESCRIPTION_MIN_LENGTH, 2000),
    durationDays: durationDaysSchema,
    lastSeenLocation: z.string().trim().min(2).max(160).optional(),
    free: z.boolean().default(true),
    initialContributionSen: z.number().int().safe().min(100).max(5000).optional(),
    policyAccepted: z.literal(true),
  })
  .refine((value) => value.free || value.initialContributionSen !== undefined, {
    path: ["initialContributionSen"],
  });

export type CommunityWantedInput = z.input<typeof communityWantedInputSchema>;

export const wantedReplyInputSchema = z.object({
  body: authoredText(2, 1000),
  /** The message this one answers, quoted above it. */
  parentId: z.string().uuid().optional(),
});

export const wantedReplyEditSchema = z.object({
  body: authoredText(2, 1000),
});

export const wantedReplyHideSchema = z.union([
  z.object({ hide: z.literal(true), reasonCode: z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/) }),
  z.object({ hide: z.literal(false) }),
]);

/** An optional id: "" and null both mean none. */
const optionalId = z
  .union([uuid, z.literal("")])
  .nullish()
  .transform((value) => value || null);

/**
 * The poster corrects a published Wanted in its first hour (migration
 * 202610200004). Which fields count depends on the kind: an academic Wanted
 * needs faculty, programme, course code, resource type and language; a missing
 * item takes a last-seen place; the rest are ignored. University, bounty,
 * duration, fee and policy snapshots, kind and free/paid stay as published.
 */
export const wantedPosterEditSchema = z.object({
  title: authoredText(8, 120),
  description: authoredText(DESCRIPTION_MIN_LENGTH, 2000),
  campusId: uuid,
  facultyId: optionalId,
  programmeId: optionalId,
  courseCode: z
    .union([z.string().trim().regex(COURSE_CODE_PATTERN), z.literal("")])
    .nullish()
    .transform((value) => value || null),
  academicSessionId: optionalId,
  resourceTypeId: optionalId,
  languageId: optionalId,
  lastSeenLocation: z
    .union([z.string().trim().min(2).max(160), z.string().trim().length(0)])
    .nullish()
    .transform((value) => value || null),
  tagIds: z
    .array(uuid)
    .max(5)
    .refine((ids) => new Set(ids).size === ids.length),
});
export type WantedPosterEditInput = z.input<typeof wantedPosterEditSchema>;
export type ValidatedWantedPosterEdit = z.output<typeof wantedPosterEditSchema>;

/** What the edit dialog starts from: the Wanted as published. */
export interface WantedEditableDetails {
  kind: WantedKind;
  title: string;
  description: string;
  campusId: string;
  facultyId: string | null;
  programmeId: string | null;
  courseCode: string | null;
  academicSessionId: string | null;
  resourceTypeId: string | null;
  languageId: string | null;
  lastSeenLocation: string | null;
  tagIds: string[];
}

export type ReadWantedEditableDetailsResult = OperationResult<
  WantedEditableDetails,
  MarketplaceOperationCode
>;

/** Minutes after publication during which the poster may edit or withdraw. */
export const POSTER_CHANGE_WINDOW_MINUTES = 60;

/**
 * Why the poster can no longer edit or withdraw: the Wanted is not open, the
 * hour has passed, a Hunter has submitted a claim, or someone else replied.
 */
export type WantedChangeLock = "not_open" | "window_closed" | "claim_submitted" | "reply_received";

/** Read by the poster only; nobody else learns whether claims or replies exist. */
export interface WantedChangeWindow {
  editableUntil: string;
  /** Null while the poster may still edit or withdraw. */
  lockedReason: WantedChangeLock | null;
}

export type ReadWantedChangeWindowResult = OperationResult<
  WantedChangeWindow,
  MarketplaceOperationCode
>;
export type EditPublishedWantedResult = OperationResult<
  { state: "edited" },
  MarketplaceOperationCode
>;
/** Every contribution goes to the Owner's manual refund queue. */
export type WithdrawWantedResult = OperationResult<
  { state: "withdrawn"; refundsQueued: number },
  MarketplaceOperationCode
>;

/** Minutes after posting during which the author may edit a message. */
export const REPLY_EDIT_WINDOW_MINUTES = 15;

export interface WantedReply {
  id: string;
  /** Empty when deleted: the text is erased, not hidden. */
  body: string;
  createdAt: string;
  author: PublicMemberCard;
  editedAt: string | null;
  deleted: boolean;
  /** The quoted message this one answers, if any. */
  parent: {
    id: string;
    authorName: string;
    /** The first 140 characters; empty when the quoted message was deleted. */
    excerpt: string;
    deleted: boolean;
  } | null;
}

/** The public face of a member: never an email, evidence, claim or contribution. */
export interface PublicMemberCard {
  publicId: string;
  displayName: string;
  avatarUrl: string | null;
  /** The Owner-awarded badge, if the member wears one. */
  badge?: MemberBadge | null;
}

/** A campus as the map shows it. Closed regions carry no counts. */
export interface CampusRegion {
  id: string;
  name: string;
  regionOpen: boolean;
  latitude: number | null;
  longitude: number | null;
  /** Pin position on the illustrated map (percent), or null for list only. */
  mapX: number | null;
  mapY: number | null;
  openWantedCount: number;
  openBountySen: Sen;
}

export interface TaxonomyItem {
  id: string;
  slug: string;
  label: string;
}

export interface CampusOption extends TaxonomyItem {
  /** Only campuses in an open region accept new Wanteds. */
  regionOpen: boolean;
}

export interface ProgrammeOption extends TaxonomyItem {
  facultyId: string;
}

export interface CourseOption extends TaxonomyItem {
  code: string;
  programmeId: string;
}

export interface MarketplaceTaxonomy {
  provenance: "reviewed_configuration";
  campuses: CampusOption[];
  faculties: TaxonomyItem[];
  programmes: ProgrammeOption[];
  courses: CourseOption[];
  academicSessions: TaxonomyItem[];
  resourceTypes: TaxonomyItem[];
  languages: TaxonomyItem[];
  tags: TaxonomyItem[];
}

export interface WantedDraftView {
  id: string;
  state: "draft" | "awaiting_payment";
  values: ValidatedWantedDraftInput;
  updatedAt: string;
}

export interface WantedSummary {
  id: string;
  kind: WantedKind;
  /** No bounty: nobody pays, no fee is taken, the poster receives the resource. */
  isFree: boolean;
  title: string;
  courseCode: string;
  courseName: string;
  courseId: string;
  campus: string;
  campusId: string;
  resourceType: string;
  resourceTypeId: string;
  session: string;
  sessionId: string;
  grossBountySen: Sen;
  backerCount: number;
  status: "open" | "ending-soon" | "well-funded" | "reviewing" | "closed";
  postedAt: string;
  closesAt: string;
  /** Missing items only: where it was last seen. */
  lastSeenLocation: string | null;
  /** The chat thread's retention state. Absent in fixtures predating it. */
  thread?: WantedThreadState;
  /** The poster's chosen picture; absent or null shows the automatic drawing. */
  picture?: WantedPicture | null;
  /** The university it belongs to. Absent in fixtures predating it. */
  institutionId?: string;
}

/**
 * Why a backed Wanted left the Board, as its Backer sees it: withdrawn by its
 * poster, removed by the Owner, expired without a winner, or (a payment
 * confirmed after it closed) closed.
 */
export type ClosedBackingReason = "withdrawn" | "removed" | "expired" | "closed";

/** none: no refund task; pending: one not yet recorded; refunded: all recorded. */
export type BackingRefundState = "none" | "pending" | "refunded";

/** A Wanted the member backed that closed and owes or owed them a refund. */
export interface ClosedBacking {
  publicId: string;
  title: string;
  reason: ClosedBackingReason;
  refundState: BackingRefundState;
  /** Contribution + fee over the member's refund tasks for it. */
  refundSen: Sen;
  backedAt: string;
}

/**
 * The member's own backings (migration 202610200005): live Wanteds as cards,
 * closed ones with their refund state. Never part of a public profile.
 */
export interface OwnBackings {
  live: WantedSummary[];
  closed: ClosedBacking[];
}

/**
 * Retention of a Wanted's chat thread (migration 202610100001). A thread
 * closes when its Wanted leaves open/reviewing; seven days later its messages
 * are deleted, and a missing-item or discussion card leaves the Board too.
 */
export interface WantedThreadState {
  replyCount: number;
  /** When the thread stopped taking messages; null while open. */
  closedAt: string | null;
  /** Closed by itself after 30 days without a new message. */
  autoClosed: boolean;
  /**
   * The earliest the messages (and a community card) are removed. Null while
   * open, and while a bounty release or refund is still unsettled.
   */
  vanishesAt: string | null;
  /** Until when the poster may reopen it; null when it cannot be reopened. */
  reopenUntil: string | null;
  /** When the messages were deleted; null until then. */
  clearedAt: string | null;
}

export interface WantedDetail extends WantedSummary {
  description: string;
  faculty: string;
  programme: string;
  language: string;
  tags: string[];
  commissioner: {
    publicId: string | null;
    displayName: string;
    avatarUrl: string | null;
    joinedAt: string | null;
    emailVerified: boolean;
    institutionVerified: boolean;
  };
  feeRateBasisPoints: number;
  policyVersion: string;
  activity: Array<{ id: string; at: string; summary: string }>;
  similarIds: string[];
}

export interface WantedDuplicateSuggestion {
  wanted: WantedSummary;
  reasons: Array<"same_course" | "same_resource_type" | "same_session" | "similar_title">;
}

export interface ListWantedQuery {
  /**
   * The university shown. Set by the server from the reader's university
   * (loadUniversityChoice), never taken from the query string.
   */
  institutionId?: string;
  query?: string;
  campusId?: string;
  courseId?: string;
  resourceTypeId?: string;
  academicSessionId?: string;
  status?: "open" | "reviewing";
  kind?: WantedKind;
  sort?: "newest" | "highest_bounty" | "ending_soon";
}

export interface MarketplaceViewerCapabilities {
  browseMetadata: boolean;
  createWanted: boolean;
  fundWanted: boolean;
  submitClaim: boolean;
  denialReason:
    | "auth_required"
    | "email_not_verified"
    | "institution_not_verified"
    | "account_restricted"
    | null;
}

export type ListTaxonomyResult = OperationResult<MarketplaceTaxonomy, MarketplaceOperationCode>;
export type CreateWantedDraftResult = OperationResult<WantedDraftView, MarketplaceOperationCode>;
export type UpdateWantedDraftInput = WantedDraftInput & { draftId: string };
export type UpdateWantedDraftResult = OperationResult<WantedDraftView, MarketplaceOperationCode>;
export type SuggestWantedDuplicatesResult = OperationResult<
  { token: string; expiresAt: string; suggestions: WantedDuplicateSuggestion[] },
  MarketplaceOperationCode
>;
export type PrepareWantedPublicationResult = OperationResult<
  { draftId: string; state: "awaiting_payment"; paymentRequired: true },
  MarketplaceOperationCode
>;
export type ListWantedResult = OperationResult<WantedSummary[], MarketplaceOperationCode>;
export type ReadWantedResult = OperationResult<WantedDetail, MarketplaceOperationCode>;
export type PublishFreeWantedResult = OperationResult<
  { wantedId: string; state: "open" },
  MarketplaceOperationCode
>;
export type PublishCommunityWantedResult = OperationResult<
  { wantedId: string; state: "open" },
  MarketplaceOperationCode
>;
export type ListWantedRepliesResult = OperationResult<WantedReply[], MarketplaceOperationCode>;
export type PostWantedReplyResult = OperationResult<{ replyId: string }, MarketplaceOperationCode>;
export type ChangeWantedReplyResult = OperationResult<
  { state: "edited" | "deleted" | "hidden" | "restored" },
  MarketplaceOperationCode
>;
export type ResolveWantedResult = OperationResult<{ state: "closed" }, MarketplaceOperationCode>;
export type ReopenWantedResult = OperationResult<{ state: "open" }, MarketplaceOperationCode>;
/** Free requests: 3 for every member, plus any added by reward codes. */
export interface FreeRequestAllowance {
  base: number;
  bonus: number;
  used: number;
  remaining: number;
}
export type ReadFreeAllowanceResult = OperationResult<
  FreeRequestAllowance,
  MarketplaceOperationCode
>;

/** The poster names the member who helped; a Sheriff decides. */
export const communityPayoutInputSchema = z.object({
  finderPublicId: uuid,
  note: z.string().trim().max(500).optional(),
});
export type CommunityPayoutInput = z.input<typeof communityPayoutInputSchema>;
export type RequestCommunityPayoutResult = OperationResult<
  { requestId: string; state: "pending" },
  MarketplaceOperationCode
>;

export interface CommunityPayoutRequestView {
  id: string;
  wanted: { id: string; title: string; kind: "missing_item" | "discussion" };
  bountySen: Sen;
  requester: PublicMemberCard;
  finder: PublicMemberCard;
  note: string | null;
  createdAt: string;
  /**
   * The viewer is the poster or the named helper. Listed so it does not seem
   * to vanish; the database refuses a party's decision.
   */
  viewerIsParty: boolean;
}
export type ListCommunityPayoutRequestsResult = OperationResult<
  CommunityPayoutRequestView[],
  MarketplaceOperationCode
>;
export const communityPayoutDecisionSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});
export type DecideCommunityPayoutResult = OperationResult<
  { state: "approved" | "rejected" },
  MarketplaceOperationCode
>;

export type ListCampusRegionsResult = OperationResult<CampusRegion[], MarketplaceOperationCode>;
