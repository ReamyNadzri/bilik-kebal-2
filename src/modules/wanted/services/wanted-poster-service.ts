import {
  DESCRIPTION_MIN_LENGTH,
  wantedPosterEditSchema,
  type EditPublishedWantedResult,
  type ReadWantedChangeWindowResult,
  type ReadWantedEditableDetailsResult,
  type ValidatedWantedPosterEdit,
  type WantedChangeLock,
  type WantedChangeWindow,
  type WantedEditableDetails,
  type WithdrawWantedResult,
} from "@/contracts/marketplace";
import { failure, success } from "@/contracts/operation-result";
import type { WantedActor } from "../domain/wanted-policy";

/**
 * The poster's own changes to a published Wanted (migrations 202610130002
 * and 202610200004).
 *
 * The database decides every rule — owner, one hour, no claim, no reply from
 * anyone else, values that fit the Wanted's university — under a row lock.
 * This service validates input, files a newly typed course code, skips a save
 * that changes nothing, maps the database's refusals to operation codes and
 * writes the reader's English.
 */

/** The details as published, with the course's internal id kept server-side. */
export interface StoredEditableDetails extends WantedEditableDetails {
  courseId: string | null;
}

/** Every editable detail, resolved: the course as an id, fields the kind does not use null. */
export interface PublishedWantedChange {
  title: string;
  description: string;
  campusId: string;
  facultyId: string | null;
  programmeId: string | null;
  courseId: string | null;
  academicSessionId: string | null;
  resourceTypeId: string | null;
  languageId: string | null;
  lastSeenLocation: string | null;
  tagIds: string[];
}

export interface WantedPosterRepository {
  /** Null when the caller is not the poster or the Wanted was never published. */
  readChangeWindow(publicId: string): Promise<WantedChangeWindow | null>;
  /** Null unless `posterUserId` posted it. */
  readEditableDetails(
    publicId: string,
    posterUserId: string,
  ): Promise<StoredEditableDetails | null>;
  /** The course a typed code names, filed when new; null when switched off. */
  ensureCourse(programmeId: string, courseCode: string): Promise<string | null>;
  updatePublishedWanted(publicId: string, change: PublishedWantedChange): Promise<void>;
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

const TEXT_RULE = `The title needs 8 to 120 characters and the description ${DESCRIPTION_MIN_LENGTH} to 2000.`;
const DETAILS_RULE = "Some details are missing or not valid. Check them and save again.";
const ACADEMIC_RULE =
  "An academic Wanted needs its faculty, programme, course code, resource type and language.";
const NO_LONGER_FITS =
  "One of the details no longer fits this university. Check them and save again.";
const COURSE_OFF = "That course is switched off. Check the code, or ask a Sheriff.";

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

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** The edit with the course still as a code, and every field the kind does not use null. */
function forKind(current: StoredEditableDetails, edit: ValidatedWantedPosterEdit) {
  const academic = current.kind === "academic";
  return {
    title: edit.title,
    description: edit.description,
    campusId: edit.campusId,
    facultyId: academic ? edit.facultyId : null,
    programmeId: academic ? edit.programmeId : null,
    courseCode: academic ? edit.courseCode : null,
    academicSessionId: academic ? edit.academicSessionId : null,
    resourceTypeId: academic ? edit.resourceTypeId : null,
    languageId: academic ? edit.languageId : null,
    lastSeenLocation: current.kind === "missing_item" ? edit.lastSeenLocation : null,
    tagIds: edit.tagIds,
  };
}

function unchanged(current: StoredEditableDetails, next: ReturnType<typeof forKind>): boolean {
  return (
    next.title === current.title &&
    next.description === current.description &&
    next.campusId === current.campusId &&
    next.facultyId === current.facultyId &&
    next.programmeId === current.programmeId &&
    next.courseCode === current.courseCode &&
    next.academicSessionId === current.academicSessionId &&
    next.resourceTypeId === current.resourceTypeId &&
    next.languageId === current.languageId &&
    next.lastSeenLocation === current.lastSeenLocation &&
    sameTags(next.tagIds, current.tagIds)
  );
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

  /** What the edit dialog starts from; refused to everyone but the poster. */
  async editableDetails(
    actor: WantedActor | null,
    publicId: string,
  ): Promise<ReadWantedEditableDetailsResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "");
    if (!UUID.test(publicId)) return failure("WANTED_NOT_FOUND", "");
    try {
      const details = await this.repository.readEditableDetails(publicId, actor.userId);
      if (!details) return failure("WANTED_NOT_FOUND", "");
      return success({
        kind: details.kind,
        title: details.title,
        description: details.description,
        campusId: details.campusId,
        facultyId: details.facultyId,
        programmeId: details.programmeId,
        courseCode: details.courseCode,
        academicSessionId: details.academicSessionId,
        resourceTypeId: details.resourceTypeId,
        languageId: details.languageId,
        lastSeenLocation: details.lastSeenLocation,
        tagIds: details.tagIds,
      });
    } catch {
      return failure("MARKETPLACE_UNAVAILABLE", "The Wanted's details could not be read.");
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
      const textWrong = parsed.error.issues.some(
        (issue) => issue.path[0] === "title" || issue.path[0] === "description",
      );
      return failure("VALIDATION_ERROR", textWrong ? TEXT_RULE : DETAILS_RULE);
    }
    try {
      const current = await this.repository.readEditableDetails(publicId, actor!.userId);
      if (!current) return failure("WANTED_NOT_FOUND", "");
      const next = forKind(current, parsed.data);
      if (
        current.kind === "academic" &&
        (next.facultyId === null ||
          next.programmeId === null ||
          next.courseCode === null ||
          next.resourceTypeId === null ||
          next.languageId === null)
      ) {
        return failure("VALIDATION_ERROR", ACADEMIC_RULE);
      }
      if (unchanged(current, next)) return success({ state: "edited" });

      // The published course is kept as it is; only a newly typed code is filed.
      let courseId: string | null = null;
      if (next.courseCode !== null && next.programmeId !== null) {
        courseId =
          next.courseCode === current.courseCode
            ? current.courseId
            : await this.repository.ensureCourse(next.programmeId, next.courseCode);
        if (courseId === null) return failure("VALIDATION_ERROR", COURSE_OFF);
      }
      await this.repository.updatePublishedWanted(publicId, {
        title: next.title,
        description: next.description,
        campusId: next.campusId,
        facultyId: next.facultyId,
        programmeId: next.programmeId,
        courseId,
        academicSessionId: next.academicSessionId,
        resourceTypeId: next.resourceTypeId,
        languageId: next.languageId,
        lastSeenLocation: next.lastSeenLocation,
        tagIds: next.tagIds,
      });
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
    if (
      message.includes("wanted_change_invalid") ||
      message.includes("wanted_taxonomy_invalid") ||
      message.includes("course_code_invalid")
    )
      return failure("VALIDATION_ERROR", NO_LONGER_FITS);
    if (message.includes("wanted_actor_not_eligible"))
      return failure(
        "INSTITUTION_VERIFICATION_REQUIRED",
        "Adding a new course code needs institution verification at this university.",
      );
    return failure("MARKETPLACE_UNAVAILABLE", fallback);
  }
}
