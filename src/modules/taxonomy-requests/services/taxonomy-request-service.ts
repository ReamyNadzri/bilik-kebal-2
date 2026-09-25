import { failure, success } from "@/contracts/operation-result";
import {
  taxonomyDecisionSchema,
  taxonomyRequestInputSchema,
  type DecideTaxonomyRequestResult,
  type ListTaxonomyRequestsResult,
  type SubmitTaxonomyRequestResult,
  type TaxonomyRequestCategory,
  type TaxonomyRequestView,
} from "@/contracts/taxonomy-requests";

export interface TaxonomyRequestRepository {
  submit(input: {
    category: TaxonomyRequestCategory;
    label: string;
    courseCode: string | null;
    parentId: string | null;
    note: string | null;
  }): Promise<string>;
  listOwn(userId: string): Promise<TaxonomyRequestView[]>;
  listPendingForReview(viewerUserId: string): Promise<TaxonomyRequestView[]>;
  decide(input: {
    requestId: string;
    approve: boolean;
    note: string | null;
    openRegion: boolean;
  }): Promise<void>;
}

export interface TaxonomyRequestActor {
  readonly userId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function databaseMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
}

/**
 * A member asks a Sheriff to add a campus, faculty, programme, course,
 * session, resource type or tag to the shared lists. The Sheriff decides, and
 * the database notifies the member in the app and by email. Every write is
 * re-authorised in the database; these checks only give a clear refusal early.
 */
export class TaxonomyRequestService {
  constructor(private readonly repository: TaxonomyRequestRepository) {}

  async submit(
    actor: TaxonomyRequestActor | null,
    input: unknown,
  ): Promise<SubmitTaxonomyRequestResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to ask for a new entry.");
    const parsed = taxonomyRequestInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Give a name of 2 to 160 characters. A programme needs its faculty; a course needs its programme and course code.",
      );
    }
    try {
      const requestId = await this.repository.submit({
        category: parsed.data.category,
        courseCode: parsed.data.courseCode ?? null,
        label: parsed.data.label,
        note: parsed.data.note || null,
        parentId: parsed.data.parentId ?? null,
      });
      return success({ requestId, state: "pending" });
    } catch (error) {
      const message = databaseMessage(error);
      if (message.includes("taxonomy_request_not_eligible")) {
        return failure("INSTITUTION_VERIFICATION_REQUIRED", "Verify your institution first.");
      }
      if (message.includes("taxonomy_request_limit_reached")) {
        return failure(
          "REQUEST_LIMIT_REACHED",
          "You have 10 requests waiting. Wait for a Sheriff to decide some first.",
        );
      }
      if (message.includes("taxonomy_request_parent_invalid")) {
        return failure("VALIDATION_ERROR", "Choose the faculty or programme it belongs to.");
      }
      return failure("TAXONOMY_REQUESTS_UNAVAILABLE", "Your request could not be sent. Try again.");
    }
  }

  async listOwn(actor: TaxonomyRequestActor | null): Promise<ListTaxonomyRequestsResult> {
    if (!actor) return failure("AUTH_REQUIRED", "");
    try {
      return success(await this.repository.listOwn(actor.userId));
    } catch {
      return failure("TAXONOMY_REQUESTS_UNAVAILABLE", "Your requests could not be loaded.");
    }
  }

  async listQueue(actor: TaxonomyRequestActor | null): Promise<ListTaxonomyRequestsResult> {
    if (!actor) return failure("AUTH_REQUIRED", "");
    try {
      return success(await this.repository.listPendingForReview(actor.userId));
    } catch {
      return failure("TAXONOMY_REQUESTS_UNAVAILABLE", "Entry requests could not be loaded.");
    }
  }

  async decide(
    actor: TaxonomyRequestActor | null,
    requestId: string,
    input: unknown,
  ): Promise<DecideTaxonomyRequestResult> {
    if (!actor) return failure("AUTH_REQUIRED", "");
    if (!UUID.test(requestId)) return failure("REQUEST_NOT_FOUND", "");
    const parsed = taxonomyDecisionSchema.safeParse(input);
    if (!parsed.success) return failure("VALIDATION_ERROR", "Choose approve or reject.");
    try {
      await this.repository.decide({
        approve: parsed.data.approve,
        note: parsed.data.note || null,
        openRegion: parsed.data.openRegion === true,
        requestId,
      });
      return success({ state: parsed.data.approve ? "approved" : "rejected" });
    } catch (error) {
      const message = databaseMessage(error);
      if (message.includes("taxonomy_reviewer_not_authorized")) {
        return failure("NOT_AUTHORIZED", "Only a Sheriff can decide entry requests.");
      }
      if (message.includes("taxonomy_request_not_found")) {
        return failure("REQUEST_NOT_FOUND", "This request has already been decided.");
      }
      if (message.includes("taxonomy_course_code_exists")) {
        return failure("COURSE_CODE_EXISTS", "A course with this code already exists.");
      }
      return failure("TAXONOMY_REQUESTS_UNAVAILABLE", "The decision could not be saved.");
    }
  }
}
