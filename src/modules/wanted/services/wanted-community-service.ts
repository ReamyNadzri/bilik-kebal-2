import {
  communityWantedInputSchema,
  wantedReplyInputSchema,
  type ListWantedRepliesResult,
  type PostWantedReplyResult,
  type PublishCommunityWantedResult,
  type ResolveWantedResult,
  type WantedReply,
} from "@/contracts/marketplace";
import { failure, success } from "@/contracts/operation-result";
import { canManageWantedDraft, type WantedActor } from "../domain/wanted-policy";

export interface CommunityWantedRepository {
  publishCommunityWanted(input: {
    kind: "missing_item" | "discussion";
    campusId: string;
    title: string;
    description: string;
    durationDays: number;
    lastSeenLocation: string | null;
    policyVersion: string;
  }): Promise<string>;
  listReplies(publicId: string): Promise<WantedReply[]>;
  postReply(publicId: string, body: string): Promise<string>;
  resolveCommunityWanted(publicId: string): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function databaseMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
}

/**
 * Missing-item and discussion Wanteds: opened in one step, always free, with a
 * text reply thread. No file, bounty, fee or entitlement is involved. Every
 * write is re-authorised in the database (institution verification, open
 * region, ownership); these checks only give a clear refusal early.
 */
export class WantedCommunityService {
  constructor(
    private readonly repository: CommunityWantedRepository,
    private readonly policyVersion = "2026-09-15.1",
  ) {}

  async publish(actor: WantedActor | null, input: unknown): Promise<PublishCommunityWantedResult> {
    const denial = canManageWantedDraft(actor);
    if (denial) return failure(denial, "Your account is not eligible to post a Wanted.");
    const parsed = communityWantedInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "Check the title, description, campus and duration.");
    }
    try {
      const wantedId = await this.repository.publishCommunityWanted({
        campusId: parsed.data.campusId,
        description: parsed.data.description,
        durationDays: parsed.data.durationDays,
        kind: parsed.data.kind,
        lastSeenLocation:
          parsed.data.kind === "missing_item" ? (parsed.data.lastSeenLocation ?? null) : null,
        policyVersion: this.policyVersion,
        title: parsed.data.title,
      });
      return success({ state: "open", wantedId });
    } catch (error) {
      if (databaseMessage(error).includes("wanted_region_closed")) {
        return failure("REGION_CLOSED", "");
      }
      if (databaseMessage(error).includes("wanted_actor_not_eligible")) {
        return failure("INSTITUTION_VERIFICATION_REQUIRED", "");
      }
      return failure("MARKETPLACE_UNAVAILABLE", "Posting is temporarily unavailable. Try again.");
    }
  }

  async listReplies(actor: WantedActor | null, publicId: string): Promise<ListWantedRepliesResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    if (!actor.emailVerified) return failure("EMAIL_NOT_VERIFIED", "");
    if (!UUID.test(publicId)) return failure("WANTED_NOT_FOUND", "");
    try {
      return success(await this.repository.listReplies(publicId));
    } catch {
      return failure("MARKETPLACE_UNAVAILABLE", "Replies are temporarily unavailable.");
    }
  }

  async reply(
    actor: WantedActor | null,
    publicId: string,
    input: unknown,
  ): Promise<PostWantedReplyResult> {
    const denial = canManageWantedDraft(actor);
    if (denial) return failure(denial, "Replying needs a verified institution account.");
    if (!UUID.test(publicId)) return failure("WANTED_NOT_FOUND", "");
    const parsed = wantedReplyInputSchema.safeParse(input);
    if (!parsed.success)
      return failure("VALIDATION_ERROR", "Write a reply of 2 to 1000 characters.");
    try {
      return success({ replyId: await this.repository.postReply(publicId, parsed.data.body) });
    } catch (error) {
      if (databaseMessage(error).includes("wanted_not_found"))
        return failure("WANTED_NOT_FOUND", "");
      return failure("MARKETPLACE_UNAVAILABLE", "Your reply could not be posted. Try again.");
    }
  }

  async resolve(actor: WantedActor | null, publicId: string): Promise<ResolveWantedResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    if (!UUID.test(publicId)) return failure("WANTED_NOT_FOUND", "");
    try {
      await this.repository.resolveCommunityWanted(publicId);
      return success({ state: "closed" });
    } catch (error) {
      if (databaseMessage(error).includes("wanted_not_resolvable")) {
        return failure(
          "NOT_AUTHORIZED",
          "Only the poster can mark this resolved while it is open.",
        );
      }
      return failure("MARKETPLACE_UNAVAILABLE", "This could not be marked resolved. Try again.");
    }
  }
}
