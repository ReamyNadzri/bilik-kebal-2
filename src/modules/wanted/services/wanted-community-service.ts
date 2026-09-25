import {
  CURRENT_POLICY_VERSION,
  communityPayoutDecisionSchema,
  communityPayoutInputSchema,
  communityWantedInputSchema,
  type CommunityPayoutRequestView,
  type DecideCommunityPayoutResult,
  type FreeRequestAllowance,
  type ListCommunityPayoutRequestsResult,
  type ReadFreeAllowanceResult,
  type RequestCommunityPayoutResult,
  wantedReplyInputSchema,
  type ListWantedRepliesResult,
  type PostWantedReplyResult,
  type PublishCommunityWantedResult,
  type ReopenWantedResult,
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
  reopenCommunityWanted(publicId: string): Promise<void>;
  readFreeAllowance(): Promise<FreeRequestAllowance>;
  requestCommunityPayout(input: {
    publicId: string;
    finderPublicId: string;
    note: string | null;
  }): Promise<string>;
  listPendingCommunityPayouts(viewerUserId: string): Promise<CommunityPayoutRequestView[]>;
  decideCommunityPayout(input: {
    requestId: string;
    approve: boolean;
    note: string | null;
  }): Promise<void>;
}

export interface CommunityServiceOptions {
  readonly policyVersion?: string;
  /** Whether a paid request can reach the payment provider in this build. */
  readonly paymentAvailability?: "disabled" | "unavailable";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function databaseMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
}

/**
 * Missing-item and discussion Wanteds, with a text reply thread and no file.
 * A free one opens in one step and uses one of the member's free requests. A
 * paid one needs its first contribution, so like a paid academic request it
 * cannot open while payment is disabled; nothing is written in that case.
 *
 * A paid bounty is released only when the poster names the member who helped
 * and a Sheriff approves; approval creates a manual payout task. Every write is
 * re-authorised in the database; these checks only give a clear refusal early.
 */
export class WantedCommunityService {
  private readonly policyVersion: string;
  private readonly paymentAvailability: "disabled" | "unavailable";

  constructor(
    private readonly repository: CommunityWantedRepository,
    options: CommunityServiceOptions = {},
  ) {
    this.policyVersion = options.policyVersion ?? CURRENT_POLICY_VERSION;
    this.paymentAvailability = options.paymentAvailability ?? "disabled";
  }

  async publish(actor: WantedActor | null, input: unknown): Promise<PublishCommunityWantedResult> {
    const denial = canManageWantedDraft(actor);
    if (denial) return failure(denial, "Your account is not eligible to post a Wanted.");
    const parsed = communityWantedInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "Check the title, description, campus and duration.");
    }
    if (!parsed.data.free) {
      // No draft is kept: the request would only wait for a payment step
      // that this build cannot take.
      return this.paymentAvailability === "disabled"
        ? failure("PAYMENT_DISABLED", "")
        : failure("PAYMENT_UNAVAILABLE", "");
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
      if (databaseMessage(error).includes("wanted_free_limit_reached")) {
        return failure("FREE_LIMIT_REACHED", "");
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
      if (databaseMessage(error).includes("wanted_reply_link_not_allowed")) {
        return failure(
          "VALIDATION_ERROR",
          "Links, email addresses and chat handles are not allowed in bounty questions. Send files through a Claim so a Sheriff can review them.",
        );
      }
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

  /** The poster takes back "found" or "resolved" within the 7 days. */
  async reopen(actor: WantedActor | null, publicId: string): Promise<ReopenWantedResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    if (!UUID.test(publicId)) return failure("WANTED_NOT_FOUND", "");
    try {
      await this.repository.reopenCommunityWanted(publicId);
      return success({ state: "open" });
    } catch (error) {
      if (databaseMessage(error).includes("wanted_not_reopenable")) {
        return failure(
          "NOT_AUTHORIZED",
          "Only the poster can reopen this, within 7 days of closing it and before it ends.",
        );
      }
      return failure("MARKETPLACE_UNAVAILABLE", "This could not be reopened. Try again.");
    }
  }

  async freeAllowance(actor: WantedActor | null): Promise<ReadFreeAllowanceResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    try {
      return success(await this.repository.readFreeAllowance());
    } catch {
      return failure("MARKETPLACE_UNAVAILABLE", "Your free requests could not be counted.");
    }
  }

  async requestPayout(
    actor: WantedActor | null,
    publicId: string,
    input: unknown,
  ): Promise<RequestCommunityPayoutResult> {
    const denial = canManageWantedDraft(actor);
    if (denial) return failure(denial, "");
    if (!UUID.test(publicId)) return failure("WANTED_NOT_FOUND", "");
    const parsed = communityPayoutInputSchema.safeParse(input);
    if (!parsed.success) return failure("VALIDATION_ERROR", "Choose the member who helped you.");
    try {
      const requestId = await this.repository.requestCommunityPayout({
        finderPublicId: parsed.data.finderPublicId,
        note: parsed.data.note || null,
        publicId,
      });
      return success({ requestId, state: "pending" });
    } catch (error) {
      const message = databaseMessage(error);
      if (message.includes("community_payout_no_bounty")) {
        return failure("VALIDATION_ERROR", "This request has no bounty to release.");
      }
      if (message.includes("community_payout_finder_invalid")) {
        return failure("VALIDATION_ERROR", "Choose another member. You cannot name yourself.");
      }
      if (message.includes("community_payout_not_requestable")) {
        return failure(
          "NOT_AUTHORIZED",
          "Only the poster can ask, once, while no other release is being reviewed.",
        );
      }
      return failure("MARKETPLACE_UNAVAILABLE", "Your request could not be sent. Try again.");
    }
  }

  async listPendingPayouts(actor: WantedActor | null): Promise<ListCommunityPayoutRequestsResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    try {
      return success(await this.repository.listPendingCommunityPayouts(actor.userId));
    } catch {
      return failure("MARKETPLACE_UNAVAILABLE", "Bounty releases are temporarily unavailable.");
    }
  }

  async decidePayout(
    actor: WantedActor | null,
    requestId: string,
    input: unknown,
  ): Promise<DecideCommunityPayoutResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    if (!UUID.test(requestId)) return failure("WANTED_NOT_FOUND", "");
    const parsed = communityPayoutDecisionSchema.safeParse(input);
    if (!parsed.success) return failure("VALIDATION_ERROR", "Choose approve or reject.");
    try {
      await this.repository.decideCommunityPayout({
        approve: parsed.data.approve,
        note: parsed.data.note || null,
        requestId,
      });
      return success({ state: parsed.data.approve ? "approved" : "rejected" });
    } catch (error) {
      const message = databaseMessage(error);
      if (message.includes("community_payout_reviewer_conflicted")) {
        return failure("NOT_AUTHORIZED", "You cannot decide a release you are part of.");
      }
      if (message.includes("community_payout_reviewer_not_authorized")) {
        return failure("NOT_AUTHORIZED", "Only a Sheriff can decide a bounty release.");
      }
      if (message.includes("community_payout_request_not_found")) {
        return failure("WANTED_NOT_FOUND", "This release has already been decided.");
      }
      return failure("MARKETPLACE_UNAVAILABLE", "The decision could not be saved. Try again.");
    }
  }
}
