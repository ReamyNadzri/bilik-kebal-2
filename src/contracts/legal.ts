import { z } from "zod";
import type { OperationResult } from "./operation-result";

/**
 * The Terms of Use and Privacy Notice every member accepts, with the 18+
 * confirmation (migration 202610200007).
 *
 * The version is the latest row of `terms_versions`; a new version is a new
 * migration plus a change here, and every member is asked to accept it on
 * their next visit. Separate from the posting policy version snapshotted on
 * each Wanted (`CURRENT_POLICY_VERSION`), so a wording change never touches a
 * Wanted's money rules.
 */
export const TERMS_OF_USE_VERSION = "2026-10-03";
export const TERMS_OF_USE_EFFECTIVE_DATE = "3 October 2026";

export const acceptTermsInputSchema = z.object({
  version: z.string().trim().min(1).max(32),
  confirmedAdult: z.literal(true),
});
export type AcceptTermsInput = z.input<typeof acceptTermsInputSchema>;

export type AcceptTermsCode =
  "AUTH_REQUIRED" | "VALIDATION_ERROR" | "TERMS_VERSION_STALE" | "TERMS_UNAVAILABLE";

export type AcceptTermsResult = OperationResult<
  { outcome: "accepted" | "already_accepted" },
  AcceptTermsCode
>;

/**
 * Privacy requests: a member asks for a copy of their data, a correction or a
 * deletion inside VAULTIX. Only the Owner reads and answers them; the member
 * reads the answer on their profile. No email address is exchanged.
 */
export const PRIVACY_REQUEST_KINDS = ["access", "correction", "deletion", "other"] as const;
export type PrivacyRequestKind = (typeof PRIVACY_REQUEST_KINDS)[number];

export const PRIVACY_REQUEST_LABEL: Record<PrivacyRequestKind, string> = {
  access: "A copy of my data",
  correction: "Correct my data",
  deletion: "Delete some of my data",
  other: "Another privacy question",
};

/** At most this many requests may wait for an answer at once. */
export const PRIVACY_REQUEST_OPEN_LIMIT = 3;
export const PRIVACY_REQUEST_DETAILS_MIN = 10;
export const PRIVACY_REQUEST_DETAILS_MAX = 2000;

export const submitPrivacyRequestInputSchema = z.object({
  kind: z.enum(PRIVACY_REQUEST_KINDS),
  details: z.string().trim().min(PRIVACY_REQUEST_DETAILS_MIN).max(PRIVACY_REQUEST_DETAILS_MAX),
});
export type SubmitPrivacyRequestInput = z.input<typeof submitPrivacyRequestInputSchema>;

export const answerPrivacyRequestInputSchema = z.object({
  answer: z.string().trim().min(1).max(PRIVACY_REQUEST_DETAILS_MAX),
});

export type PrivacyRequestStatus = "open" | "answered";

/** The member's own request, as their profile lists it. */
export interface OwnPrivacyRequest {
  id: string;
  kind: PrivacyRequestKind;
  details: string;
  status: PrivacyRequestStatus;
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
}

/** A request in the Owner's queue, with the member's public name. */
export interface PrivacyRequestItem extends OwnPrivacyRequest {
  memberPublicId: string;
  memberDisplayName: string;
}

export type PrivacyRequestCode =
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "NOT_AUTHORIZED"
  | "NOT_FOUND"
  | "PRIVACY_UNAVAILABLE";

export type SubmitPrivacyRequestResult = OperationResult<{ id: string }, PrivacyRequestCode>;
export type ListOwnPrivacyRequestsResult = OperationResult<OwnPrivacyRequest[], PrivacyRequestCode>;
export type ListPrivacyRequestsResult = OperationResult<PrivacyRequestItem[], PrivacyRequestCode>;
export type AnswerPrivacyRequestResult = OperationResult<{ done: true }, PrivacyRequestCode>;
