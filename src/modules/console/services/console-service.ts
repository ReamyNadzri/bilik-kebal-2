import { randomUUID } from "node:crypto";
import {
  badgeUploadSchema,
  consoleMemberActionSchema,
  createBadgeSchema,
  type BadgeUploadResult,
  type ConsoleActionResult,
  type ConsoleOperationCode,
  type ConsoleRoleResult,
  type CreateBadgeResult,
  type ListBadgesResult,
  type ListHiddenRepliesResult,
  type SearchMembersResult,
} from "@/contracts/console";
import { failure, success } from "@/contracts/operation-result";
import type { ConsoleRepository } from "../repositories/supabase-console-repository";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ConsoleActor {
  readonly userId: string;
}

function databaseMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
}

/** Maps a refused database call to a plain-English failure. */
function refusal(error: unknown, fallback: string) {
  const message = databaseMessage(error);
  const known: Array<[string, ConsoleOperationCode, string]> = [
    ["RECENT_AUTH_REQUIRED", "RECENT_AUTH_REQUIRED", "Confirm your password to continue."],
    ["NOT_AUTHORIZED", "NOT_AUTHORIZED", "Your role does not allow that action on this member."],
    ["MEMBER_NOT_FOUND", "MEMBER_NOT_FOUND", "That member no longer exists."],
    [
      "ACCOUNT_ALREADY_RESTRICTED",
      "ALREADY_RESTRICTED",
      "This member is already timed out or restricted. Lift it first.",
    ],
    ["RESTRICTION_NOT_FOUND", "VALIDATION_ERROR", "This member is not timed out or restricted."],
    ["INVALID_REASON_CODE", "VALIDATION_ERROR", "Enter a reason code such as offensive_name."],
    ["INVALID_DISPLAY_NAME", "VALIDATION_ERROR", "Names are 1 to 100 characters."],
    ["MEMBERSHIP_NOT_FOUND", "VALIDATION_ERROR", "This member has no membership there to revoke."],
    ["BADGE_NOT_FOUND", "VALIDATION_ERROR", "That badge does not exist or was retired."],
    ["badges_name_key", "VALIDATION_ERROR", "A badge with that name already exists."],
    [
      "wanted_reply_moderator_required",
      "NOT_AUTHORIZED",
      "Only a Sheriff for this request or the Owner can restore it.",
    ],
  ];
  for (const [needle, code, text] of known) {
    if (message.includes(needle)) return failure(code, text);
  }
  return failure("CONSOLE_UNAVAILABLE" as const, fallback);
}

/**
 * The Owner and Sheriff console. Validation here gives fast, clear refusals;
 * the database functions are the authority on who may do what.
 */
export class ConsoleService {
  constructor(private readonly repository: ConsoleRepository) {}

  async role(actor: ConsoleActor | null): Promise<ConsoleRoleResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    try {
      return success(await this.repository.myRole());
    } catch {
      return failure("CONSOLE_UNAVAILABLE", "The console is unavailable. Try again.");
    }
  }

  async search(actor: ConsoleActor | null, search: string | null): Promise<SearchMembersResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    const term = search?.trim().slice(0, 100) || null;
    try {
      return success(await this.repository.searchMembers(term));
    } catch (error) {
      return refusal(error, "Members could not be searched. Try again.");
    }
  }

  async act(
    actor: ConsoleActor | null,
    publicId: string,
    input: unknown,
  ): Promise<ConsoleActionResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    if (!UUID.test(publicId)) return failure("MEMBER_NOT_FOUND", "That member no longer exists.");
    const parsed = consoleMemberActionSchema.safeParse(input);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Check the action. Reason codes use lower-case letters, numbers and underscores.",
      );
    }
    try {
      await this.repository.act(publicId, parsed.data);
      return success({ done: true });
    } catch (error) {
      return refusal(error, "The change was not saved. Try again.");
    }
  }

  async hiddenReplies(actor: ConsoleActor | null): Promise<ListHiddenRepliesResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    try {
      return success(await this.repository.listHiddenReplies());
    } catch (error) {
      return refusal(error, "Hidden messages could not be loaded. Try again.");
    }
  }

  async restoreReply(actor: ConsoleActor | null, replyId: string): Promise<ConsoleActionResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    if (!UUID.test(replyId)) return failure("VALIDATION_ERROR", "That message no longer exists.");
    try {
      await this.repository.restoreReply(replyId);
      return success({ done: true });
    } catch (error) {
      return refusal(error, "The message could not be restored. Try again.");
    }
  }

  async badges(actor: ConsoleActor | null): Promise<ListBadgesResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    try {
      return success(await this.repository.listBadges());
    } catch (error) {
      return refusal(error, "Badges could not be loaded. Try again.");
    }
  }

  async createBadge(actor: ConsoleActor | null, input: unknown): Promise<CreateBadgeResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    const parsed = createBadgeSchema.safeParse(input);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "Name the badge in 2 to 40 characters.");
    }
    try {
      const badgeId = await this.repository.createBadge({
        name: parsed.data.name,
        description: parsed.data.description || null,
        imageKey: parsed.data.imageKey ?? null,
      });
      return success({ badgeId });
    } catch (error) {
      return refusal(error, "The badge was not created. Try again.");
    }
  }

  async retireBadge(actor: ConsoleActor | null, badgeId: string): Promise<ConsoleActionResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    if (!UUID.test(badgeId)) return failure("VALIDATION_ERROR", "That badge does not exist.");
    try {
      await this.repository.retireBadge(badgeId);
      return success({ done: true });
    } catch (error) {
      return refusal(error, "The badge was not retired. Try again.");
    }
  }

  /** A one-time upload slot for a badge image; the bucket lets only the Owner write. */
  async badgeUpload(actor: ConsoleActor | null, input: unknown): Promise<BadgeUploadResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    const parsed = badgeUploadSchema.safeParse(input);
    if (!parsed.success) return failure("VALIDATION_ERROR", "Use a PNG or WebP image.");
    const role = await this.repository.myRole().catch(() => null);
    if (role !== "owner") return failure("NOT_AUTHORIZED", "Only the Owner can design badges.");
    const imageKey = `${randomUUID()}.${parsed.data.contentType === "image/png" ? "png" : "webp"}`;
    try {
      return success({ ...(await this.repository.createBadgeUpload(imageKey)), imageKey });
    } catch (error) {
      return refusal(error, "The upload could not be prepared. Try again.");
    }
  }
}
