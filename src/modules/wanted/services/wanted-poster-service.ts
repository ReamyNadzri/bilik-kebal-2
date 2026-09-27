import {
  wantedPosterEditSchema,
  type EditPublishedWantedResult,
  type ReadWantedChangeWindowResult,
  type WantedChangeLock,
  type WantedChangeWindow,
  type WithdrawWantedResult,
} from "@/contracts/marketplace";
import { failure, success } from "@/contracts/operation-result";
import type { WantedActor } from "../domain/wanted-policy";

/**
 * The poster's own changes to a published Wanted (migration 202610130002).
 *
 * The database decides every rule — owner, one hour, no claim, no reply from
 * anyone else — under a row lock. This service validates input, maps the
 * database's refusals to operation codes and writes the reader's English.
 */
export interface WantedPosterRepository {
  /** Null when the caller is not the poster or the Wanted was never published. */
  readChangeWindow(publicId: string): Promise<WantedChangeWindow | null>;
  updatePublishedWanted(publicId: string, title: string, description: string): Promise<void>;
  /** Returns how many refund tasks were queued. */
  withdrawWanted(publicId: string): Promise<number>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCKS: readonly WantedChangeLock[] = [
  "not_open",
  "window_closed",
  "claim_submitted",
  "reply_received",
];

/** Why the change was refused, in words a poster can act on. */
export const WANTED_LOCK_MESSAGES: Readonly<Record<WantedChangeLock, string>> = {
  not_open: "Only an open Wanted can be changed.",
  window_closed: "The hour for changes has passed, so this Wanted is locked as published.",
  claim_submitted: "A Hunter has submitted a claim, so this Wanted is locked as published.",
  reply_received: "Someone has replied, so this Wanted is locked as published.",
};

function databaseMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
}

/** The lock named in a `wanted_change_locked:<reason>` refusal, if any. */
function lockFrom(error: unknown): WantedChangeLock | null {
  const match = /wanted_change_locked:([a-z_]+)/.exec(databaseMessage(error));
  const reason = match?.[1] as WantedChangeLock | undefined;
  return reason !== undefined && LOCKS.includes(reason) ? reason : null;
}

export class WantedPosterService {
  constructor(private readonly repository: WantedPosterRepository) {}

  async changeWindow(
    actor: WantedActor | null,
    publicId: string,
  ): Promise<ReadWantedChangeWindowResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    if (!UUID.test(publicId)) return failure("WANTED_NOT_FOUND", "");
    try {
      const window = await this.repository.readChangeWindow(publicId);
      return window ? success(window) : failure("WANTED_NOT_FOUND", "");
    } catch {
      return failure("MARKETPLACE_UNAVAILABLE", "The edit window could not be read.");
    }
  }

  async edit(
    actor: WantedActor | null,
    publicId: string,
    input: unknown,
  ): Promise<EditPublishedWantedResult> {
    const refusal = this.refuse(actor, publicId);
    if (refusal) return refusal;
    const parsed = wantedPosterEditSchema.safeParse(input);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "The title needs 8 to 120 characters and the description 20 to 2000.",
      );
    }
    try {
      await this.repository.updatePublishedWanted(
        publicId,
        parsed.data.title,
        parsed.data.description,
      );
      return success({ state: "edited" });
    } catch (error) {
      return this.failed(error, "Your changes could not be saved. Try again.");
    }
  }

  async withdraw(actor: WantedActor | null, publicId: string): Promise<WithdrawWantedResult> {
    const refusal = this.refuse(actor, publicId);
    if (refusal) return refusal;
    try {
      const refundsQueued = await this.repository.withdrawWanted(publicId);
      return success({ state: "withdrawn", refundsQueued });
    } catch (error) {
      return this.failed(error, "This Wanted could not be withdrawn. Try again.");
    }
  }

  private refuse(actor: WantedActor | null, publicId: string) {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    if (actor.restricted)
      return failure("ACCOUNT_RESTRICTED", "Your account is restricted from making changes.");
    if (!UUID.test(publicId)) return failure("WANTED_NOT_FOUND", "");
    return null;
  }

  private failed(error: unknown, fallback: string) {
    const lock = lockFrom(error);
    if (lock) return failure("WANTED_LOCKED", WANTED_LOCK_MESSAGES[lock]);
    const message = databaseMessage(error);
    if (message.includes("wanted_not_found")) return failure("WANTED_NOT_FOUND", "");
    if (message.includes("wanted_change_invalid"))
      return failure(
        "VALIDATION_ERROR",
        "The title needs 8 to 120 characters and the description 20 to 2000.",
      );
    return failure("MARKETPLACE_UNAVAILABLE", fallback);
  }
}
