import type { CreateWantedDraftResult, UpdateWantedDraftResult } from "@/contracts/marketplace";
import { wantedDraftInputSchema } from "@/contracts/marketplace";
import { failure, success } from "@/contracts/operation-result";
import { canManageWantedDraft, type WantedActor } from "../domain/wanted-policy";
import type { WantedRepository } from "../repositories/wanted-repository";

const unavailable = () =>
  failure(
    "MARKETPLACE_UNAVAILABLE" as const,
    "The Wanted workspace is temporarily unavailable. Try again.",
  );

function validationErrors(error: {
  flatten(): { fieldErrors: Record<string, string[] | undefined> };
}) {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter(
      (entry): entry is [string, string[]] => entry[1] !== undefined,
    ),
  );
}

export class WantedDraftService {
  constructor(
    private readonly repository: WantedRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(actor: WantedActor | null, rawInput: unknown): Promise<CreateWantedDraftResult> {
    const denial = canManageWantedDraft(actor);
    if (denial) return failure(denial, denialMessage(denial));
    if (!actor?.institutionId) {
      return failure(
        "INSTITUTION_VERIFICATION_REQUIRED",
        denialMessage("INSTITUTION_VERIFICATION_REQUIRED"),
      );
    }
    const parsed = wantedDraftInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Check the highlighted Wanted details.",
        validationErrors(parsed.error),
      );
    }

    try {
      if (!(await this.repository.taxonomyMatchesInstitution(actor.institutionId, parsed.data))) {
        return failure(
          "VALIDATION_ERROR",
          "Choose active catalogue values from your verified institution.",
          { taxonomy: ["One or more selections are unavailable or do not belong together."] },
        );
      }
      return success(
        await this.repository.createDraft({
          acceptedAt: this.now().toISOString(),
          commissionerUserId: actor.userId,
          institutionId: actor.institutionId,
          values: parsed.data,
        }),
      );
    } catch {
      return unavailable();
    }
  }

  async update(
    actor: WantedActor | null,
    draftId: string,
    rawInput: unknown,
  ): Promise<UpdateWantedDraftResult> {
    const denial = canManageWantedDraft(actor);
    if (denial) return failure(denial, denialMessage(denial));
    if (!actor?.institutionId) {
      return failure(
        "INSTITUTION_VERIFICATION_REQUIRED",
        denialMessage("INSTITUTION_VERIFICATION_REQUIRED"),
      );
    }
    const parsed = wantedDraftInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Check the highlighted Wanted details.",
        validationErrors(parsed.error),
      );
    }

    try {
      const existing = await this.repository.findDraft(draftId, actor.userId);
      if (!existing) return failure("DRAFT_NOT_FOUND", "Wanted draft not found.");
      if (existing.state !== "draft") {
        return failure("DRAFT_NOT_EDITABLE", "This Wanted can no longer be edited as a draft.");
      }
      if (!(await this.repository.taxonomyMatchesInstitution(actor.institutionId, parsed.data))) {
        return failure(
          "VALIDATION_ERROR",
          "Choose active catalogue values from your verified institution.",
          { taxonomy: ["One or more selections are unavailable or do not belong together."] },
        );
      }
      return success(
        await this.repository.updateDraft({
          acceptedAt: this.now().toISOString(),
          commissionerUserId: actor.userId,
          draftId,
          institutionId: actor.institutionId,
          values: parsed.data,
        }),
      );
    } catch {
      return unavailable();
    }
  }
}

function denialMessage(code: ReturnType<typeof canManageWantedDraft> & string): string {
  const messages = {
    AUTH_REQUIRED: "Sign in to create a Wanted request.",
    EMAIL_NOT_VERIFIED: "Verify your email before creating a Wanted request.",
    INSTITUTION_VERIFICATION_REQUIRED:
      "Institution verification is required before creating a Wanted request.",
    ACCOUNT_RESTRICTED: "This account is currently restricted from marketplace operations.",
  } as const;
  return messages[code];
}
