import type { MarketplaceOperationCode } from "@/contracts/marketplace";
import type { MoneyOperationCode } from "@/contracts/money";

/**
 * Plain-English copy for each marketplace failure code, and the mapping from
 * the server's field errors to the controls a reader must fix.
 *
 * Every marketplace route answers with a safe message of its own, and that
 * message is preferred: the words a user reads about their money or their
 * account should come from the operation that made the decision. This map is
 * the fallback for a failure that arrived without one — a transport error, or
 * a code a future release adds before this file knows about it.
 *
 * Money, policy, security and error wording stays clear English beside any
 * themed copy (context/ui-context.md). Nothing here may describe a payment as
 * taken, a draft as published, or a Wanted as open: Phase 3A can do none of
 * those, and only a verified provider callback ever will
 * (docs/integration/marketplace-http-contract.md).
 */
export const MARKETPLACE_MESSAGE: Record<MarketplaceOperationCode | MoneyOperationCode, string> = {
  AUTH_REQUIRED: "Sign in to continue.",
  EMAIL_NOT_VERIFIED: "Verify your email address before creating a Wanted request.",
  INSTITUTION_VERIFICATION_REQUIRED:
    "Institution verification is required before creating a Wanted request.",
  ACCOUNT_RESTRICTED: "This account is currently restricted from marketplace operations.",
  NOT_AUTHORIZED: "Your account does not have permission for that action.",
  VALIDATION_ERROR: "Check the highlighted details and try again.",
  WANTED_NOT_FOUND: "That request no longer exists.",
  DRAFT_NOT_FOUND: "That draft no longer exists on your account.",
  DRAFT_NOT_EDITABLE: "This Wanted can no longer be edited as a draft.",
  DUPLICATE_CHECK_REQUIRED: "Check for similar requests again before continuing.",
  DUPLICATE_CHECK_EXPIRED: "That similar-request check has expired. Run it again to continue.",
  PAYMENT_DISABLED:
    "Payments are switched off, so no payment was started and you have not been charged. Your draft is saved and still editable.",
  PAYMENT_UNAVAILABLE:
    "Payment could not be prepared, so no payment was started and you have not been charged. Your draft is saved and still editable.",
  AMOUNT_OUT_OF_RANGE: "Each contribution must be between RM1 and RM50.",
  MARKETPLACE_UNAVAILABLE: "The Wanted workspace is unavailable right now. Try again shortly.",
  MONEY_UNAVAILABLE: "Payment preparation is temporarily unavailable. Try again shortly.",
  PAYMENT_PROVIDER_REJECTED: "The payment provider rejected this bill request.",
  PAYMENT_CALLBACK_INVALID: "The payment callback payload was invalid.",
  PAYMENT_CALLBACK_REPLAY: "This payment event has already been processed.",
  REGION_CLOSED:
    "This campus is not open for new requests yet. VAULTIX is opening campuses region by region.",
};

/** The operation's own message when it sent one, this module's copy otherwise. */
export function messageFor(
  code: MarketplaceOperationCode | import("@/contracts/money").MoneyOperationCode,
  message: string | undefined,
): string {
  const supplied = message?.trim() ?? "";

  return supplied === ""
    ? ((MARKETPLACE_MESSAGE as Record<string, string>)[code] ??
        "An unexpected error occurred. Try again shortly.")
    : supplied;
}

export interface DraftFieldError {
  /** The control to link to. Absent when the failure belongs to no single one. */
  readonly fieldId?: string | undefined;
  readonly message: string;
}

/**
 * Draft input keys in the order the form reads, paired with the control each
 * one names.
 *
 * `taxonomy` is the server's hierarchy check — campus, faculty, programme,
 * course and session judged together — so it names no single control and is
 * reported without a link rather than blamed on an arbitrary select.
 */
const FIELD_ORDER: readonly (readonly [string, string | undefined])[] = [
  ["title", "wanted-title"],
  ["description", "wanted-description"],
  ["campusId", "wanted-campus"],
  ["facultyId", "wanted-faculty"],
  ["programmeId", "wanted-programme"],
  ["courseId", "wanted-course"],
  ["academicSessionId", "wanted-session"],
  ["resourceTypeId", "wanted-resource-type"],
  ["languageId", "wanted-language"],
  ["taxonomy", undefined],
  ["tagIds", "wanted-tags"],
  ["durationDays", "wanted-duration"],
  ["initialContributionSen", "wanted-contribution"],
  ["policyAccepted", "wanted-policy"],
];

/**
 * Turns the server's `fieldErrors` into summary entries.
 *
 * A key this file does not recognise is kept rather than dropped: a reader
 * refused for a reason the form cannot display would be left with a failure
 * and no explanation of it.
 */
export function toDraftFieldErrors(
  fieldErrors: Record<string, readonly string[]> | undefined,
): readonly DraftFieldError[] {
  if (fieldErrors === undefined) {
    return [];
  }

  const known = new Set(FIELD_ORDER.map(([key]) => key));
  const entries: DraftFieldError[] = [];

  const push = (fieldId: string | undefined, messages: readonly string[] | undefined) => {
    for (const message of messages ?? []) {
      entries.push({ fieldId, message });
    }
  };

  for (const [key, fieldId] of FIELD_ORDER) {
    push(fieldId, fieldErrors[key]);
  }

  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (!known.has(key)) {
      push(undefined, messages);
    }
  }

  return entries;
}
