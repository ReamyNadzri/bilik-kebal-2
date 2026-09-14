import { z } from "zod";
import type { OperationResult } from "./operation-result";

export type Sen = number & { readonly __brand: "Sen" };
export type WantedDurationDays = 7 | 14 | 30;
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
  | "MARKETPLACE_UNAVAILABLE";

const uuid = z.uuid();
const authoredText = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);
const durationDaysSchema = z.union([z.literal(7), z.literal(14), z.literal(30)]);

export const senSchema = z
  .number()
  .int()
  .safe()
  .nonnegative()
  .transform((value) => value as Sen);

export const wantedDraftInputSchema = z.object({
  campusId: uuid,
  facultyId: uuid,
  programmeId: uuid,
  courseId: uuid,
  academicSessionId: uuid,
  resourceTypeId: uuid,
  languageId: uuid,
  tagIds: z
    .array(uuid)
    .max(5)
    .refine((ids) => new Set(ids).size === ids.length),
  title: authoredText(8, 120),
  description: authoredText(20, 2000),
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

export interface TaxonomyItem {
  id: string;
  slug: string;
  label: string;
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
  campuses: TaxonomyItem[];
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
}

export interface WantedDetail extends WantedSummary {
  description: string;
  faculty: string;
  programme: string;
  language: string;
  tags: string[];
  commissioner: {
    displayName: string;
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
  query?: string;
  campusId?: string;
  courseId?: string;
  resourceTypeId?: string;
  academicSessionId?: string;
  status?: "open" | "reviewing";
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
