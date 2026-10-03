import { failure, success } from "@/contracts/operation-result";
import {
  PRIVACY_REQUEST_OPEN_LIMIT,
  acceptTermsInputSchema,
  answerPrivacyRequestInputSchema,
  submitPrivacyRequestInputSchema,
  type AcceptTermsResult,
  type AnswerPrivacyRequestResult,
  type ListOwnPrivacyRequestsResult,
  type ListPrivacyRequestsResult,
  type OwnPrivacyRequest,
  type PrivacyRequestItem,
  type PrivacyRequestKind,
  type PrivacyRequestStatus,
  type SubmitPrivacyRequestResult,
} from "@/contracts/legal";

export interface LegalRepository {
  acceptTerms(version: string): Promise<"accepted" | "already_accepted">;
  submitPrivacyRequest(kind: PrivacyRequestKind, details: string): Promise<string>;
  listOwnPrivacyRequests(userId: string): Promise<OwnPrivacyRequest[]>;
  listPrivacyRequests(status: PrivacyRequestStatus): Promise<PrivacyRequestItem[]>;
  answerPrivacyRequest(requestId: string, answer: string): Promise<void>;
}

export interface LegalActor {
  readonly userId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function databaseMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
}

const OWNER_ONLY = "Only the Owner reads and answers privacy requests.";
const DETAILS_RULE = "Choose what you need and describe it in 10 to 2,000 characters.";
const ANSWER_RULE = "Write an answer of up to 2,000 characters.";

/**
 * Accepting the Terms of Use (18+) and privacy requests (migration
 * 202610200007). Every write is re-checked in the database; these checks only
 * give a clear refusal early and keep database wording out of the browser.
 */
export class LegalService {
  constructor(private readonly repository: LegalRepository) {}

  async acceptTerms(actor: LegalActor | null, input: unknown): Promise<AcceptTermsResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to accept the Terms.");
    const parsed = acceptTermsInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Confirm that you are 18 or older and agree to the Terms of Use and the Privacy Notice.",
      );
    }
    try {
      return success({ outcome: await this.repository.acceptTerms(parsed.data.version) });
    } catch (error) {
      const message = databaseMessage(error);
      if (message.includes("terms_version_stale")) {
        return failure(
          "TERMS_VERSION_STALE",
          "The Terms changed while this page was open. Reload the page to read the new version.",
        );
      }
      if (message.includes("terms_auth_required")) {
        return failure("AUTH_REQUIRED", "Sign in to accept the Terms.");
      }
      return failure("TERMS_UNAVAILABLE", "Your agreement could not be saved. Try again.");
    }
  }

  async submitPrivacyRequest(
    actor: LegalActor | null,
    input: unknown,
  ): Promise<SubmitPrivacyRequestResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to send a privacy request.");
    const parsed = submitPrivacyRequestInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", DETAILS_RULE, {
        details: ["Describe your request in 10 to 2,000 characters."],
      });
    }
    try {
      return success({
        id: await this.repository.submitPrivacyRequest(parsed.data.kind, parsed.data.details),
      });
    } catch (error) {
      const message = databaseMessage(error);
      if (message.includes("privacy_request_limit")) {
        return failure(
          "RATE_LIMITED",
          `You have ${PRIVACY_REQUEST_OPEN_LIMIT} requests waiting for an answer. Wait for one to be answered first.`,
        );
      }
      if (message.includes("privacy_request_invalid")) {
        return failure("VALIDATION_ERROR", DETAILS_RULE);
      }
      if (message.includes("privacy_request_auth_required")) {
        return failure("AUTH_REQUIRED", "Sign in to send a privacy request.");
      }
      return failure("PRIVACY_UNAVAILABLE", "Your request could not be sent. Try again.");
    }
  }

  async listOwn(actor: LegalActor | null): Promise<ListOwnPrivacyRequestsResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to see your privacy requests.");
    try {
      return success(await this.repository.listOwnPrivacyRequests(actor.userId));
    } catch {
      return failure("PRIVACY_UNAVAILABLE", "Your privacy requests could not be loaded.");
    }
  }

  async listForOwner(
    actor: LegalActor | null,
    status: PrivacyRequestStatus = "open",
  ): Promise<ListPrivacyRequestsResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to continue.");
    try {
      return success(await this.repository.listPrivacyRequests(status));
    } catch (error) {
      return databaseMessage(error).includes("privacy_requests_owner_only")
        ? failure("NOT_AUTHORIZED", OWNER_ONLY)
        : failure("PRIVACY_UNAVAILABLE", "Privacy requests could not be loaded.");
    }
  }

  async answer(
    actor: LegalActor | null,
    requestId: string,
    input: unknown,
  ): Promise<AnswerPrivacyRequestResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to continue.");
    if (!UUID.test(requestId)) return failure("NOT_FOUND", "That request could not be found.");
    const parsed = answerPrivacyRequestInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", ANSWER_RULE, { answer: [ANSWER_RULE] });
    }
    try {
      await this.repository.answerPrivacyRequest(requestId, parsed.data.answer);
      return success({ done: true as const });
    } catch (error) {
      const message = databaseMessage(error);
      if (message.includes("privacy_requests_owner_only")) {
        return failure("NOT_AUTHORIZED", OWNER_ONLY);
      }
      if (message.includes("privacy_request_not_open")) {
        return failure("NOT_FOUND", "That request is already answered or no longer exists.");
      }
      if (message.includes("privacy_request_invalid")) {
        return failure("VALIDATION_ERROR", ANSWER_RULE);
      }
      return failure("PRIVACY_UNAVAILABLE", "The answer could not be saved. Try again.");
    }
  }
}
