import { randomUUID } from "node:crypto";
import { failure, success } from "@/contracts/operation-result";
import {
  removeWantedPictureSchema,
  setWantedPictureSchema,
  type SetWantedPictureResult,
  type WantedPictureUploadResult,
} from "@/contracts/wanted-pictures";

export interface WantedPictureRepository {
  /** The caller's public id, which names their upload folder. */
  ownPublicId(): Promise<string | null>;
  createUpload(objectKey: string): Promise<{ signedUrl: string }>;
  setOwn(ref: string, preset: number | null, objectKey: string | null): Promise<void>;
  remove(ref: string, reasonCode: string): Promise<void>;
}

export interface WantedPictureActor {
  readonly userId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function databaseMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
}

/**
 * A Wanted's picture. Validation here gives a fast, clear refusal; the
 * database functions decide who may set or remove one.
 */
export class WantedPictureService {
  constructor(private readonly repository: WantedPictureRepository) {}

  /** A one-time slot in the caller's own folder; the bucket takes PNG up to 64 KB. */
  async prepareUpload(actor: WantedPictureActor | null): Promise<WantedPictureUploadResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to add a picture.");
    try {
      const publicId = await this.repository.ownPublicId();
      if (!publicId) return failure("AUTH_REQUIRED", "Sign in to add a picture.");
      const objectKey = `${publicId}/${randomUUID()}.png`;
      const { signedUrl } = await this.repository.createUpload(objectKey);
      return success({ signedUrl, objectKey });
    } catch {
      return failure("PICTURE_UNAVAILABLE", "The upload could not be prepared. Try again.");
    }
  }

  async set(
    actor: WantedPictureActor | null,
    ref: string,
    input: unknown,
  ): Promise<SetWantedPictureResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to change the picture.");
    if (!UUID.test(ref)) return failure("WANTED_NOT_FOUND", "That request no longer exists.");
    const parsed = setWantedPictureSchema.safeParse(input);
    if (!parsed.success) return failure("VALIDATION_ERROR", "Choose one picture.");
    try {
      await this.repository.setOwn(ref, parsed.data.preset, parsed.data.objectKey);
      return success({ done: true });
    } catch (error) {
      const message = databaseMessage(error);
      if (message.includes("wanted_picture_not_found")) {
        return failure("WANTED_NOT_FOUND", "Only the poster can change this picture.");
      }
      if (message.includes("wanted_picture_not_allowed")) {
        return failure(
          "NOT_AUTHORIZED",
          "Your account cannot change pictures right now. Check your verification and any restriction.",
        );
      }
      if (message.includes("wanted_picture_not_uploaded")) {
        return failure("PICTURE_NOT_UPLOADED", "The picture did not finish uploading. Try again.");
      }
      if (message.includes("wanted_picture_")) {
        return failure("VALIDATION_ERROR", "That picture cannot be used.");
      }
      return failure("PICTURE_UNAVAILABLE", "The picture was not saved. Try again.");
    }
  }

  async remove(
    actor: WantedPictureActor | null,
    ref: string,
    input: unknown,
  ): Promise<SetWantedPictureResult> {
    if (!actor) return failure("AUTH_REQUIRED", "");
    if (!UUID.test(ref)) return failure("WANTED_NOT_FOUND", "That request no longer exists.");
    const parsed = removeWantedPictureSchema.safeParse(input);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        "Enter a reason code: lower-case letters, numbers and underscores.",
      );
    }
    try {
      await this.repository.remove(ref, parsed.data.reasonCode);
      return success({ done: true });
    } catch (error) {
      if (databaseMessage(error).includes("wanted_picture_moderator_required")) {
        return failure(
          "NOT_AUTHORIZED",
          "Only a Sheriff for this request or the Owner can remove its picture.",
        );
      }
      return failure("PICTURE_UNAVAILABLE", "The picture was not removed. Try again.");
    }
  }
}
