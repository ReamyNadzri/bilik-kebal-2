import { failure, success } from "@/contracts/operation-result";
import {
  setAvatarInputSchema,
  setAvatarPresetInputSchema,
  updateProfileInputSchema,
  type AvatarUploadResult,
  type ReadPublicProfileResult,
  type SetAvatarResult,
  type UpdateProfileResult,
} from "@/contracts/profiles";
import type { ProfileRepository } from "../repositories/supabase-profile-repository";

export interface ProfileActor {
  userId: string;
  emailVerified: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function message(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
}

/**
 * A member's own profile (name, bio, avatar) and anyone's public profile.
 * Ownership is re-checked by the database on every write.
 */
export class ProfileService {
  constructor(private readonly repository: ProfileRepository) {}

  async update(actor: ProfileActor | null, input: unknown): Promise<UpdateProfileResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to edit your profile.");
    const parsed = updateProfileInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "Check your display name and bio.", {
        displayName: ["Use 2 to 40 characters."],
        bio: ["Keep your bio to 160 characters."],
      });
    }
    const bio = parsed.data.bio && parsed.data.bio.length > 0 ? parsed.data.bio : null;
    try {
      await this.repository.updateOwnProfile(parsed.data.displayName, bio);
      return success({ bio, displayName: parsed.data.displayName });
    } catch {
      return failure("PROFILE_UNAVAILABLE", "Your profile could not be saved. Try again.");
    }
  }

  /** Issues a one-time upload slot for a new, already-cropped WebP avatar. */
  async requestAvatarUpload(
    actor: ProfileActor | null,
    now: () => number = Date.now,
  ): Promise<AvatarUploadResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to change your picture.");
    if (!actor.emailVerified) return failure("EMAIL_NOT_VERIFIED", "Verify your email first.");
    try {
      const publicId = await this.repository.ownPublicId();
      if (!publicId) return failure("PROFILE_NOT_FOUND", "Your profile could not be found.");
      const objectKey = `${publicId}/avatar-${now()}.webp`;
      const upload = await this.repository.createAvatarUpload(objectKey);
      return success({ objectKey, ...upload });
    } catch {
      return failure("PROFILE_UNAVAILABLE", "Picture uploads are unavailable. Try again.");
    }
  }

  async setAvatar(actor: ProfileActor | null, input: unknown): Promise<SetAvatarResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to change your picture.");
    if (!actor.emailVerified) return failure("EMAIL_NOT_VERIFIED", "Verify your email first.");
    const parsed = setAvatarInputSchema.safeParse(input);
    if (!parsed.success) return failure("VALIDATION_ERROR", "That picture could not be used.");
    try {
      await this.repository.setOwnAvatar(parsed.data.objectKey);
      return success({ avatarUrl: this.repository.avatarUrl(parsed.data.objectKey) });
    } catch (error) {
      if (message(error).includes("avatar_not_uploaded")) {
        return failure("AVATAR_NOT_UPLOADED", "The picture did not finish uploading. Try again.");
      }
      return failure("PROFILE_UNAVAILABLE", "Your picture could not be saved. Try again.");
    }
  }

  async setAvatarPreset(actor: ProfileActor | null, input: unknown): Promise<SetAvatarResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to change your picture.");
    if (!actor.emailVerified) return failure("EMAIL_NOT_VERIFIED", "Verify your email first.");
    const parsed = setAvatarPresetInputSchema.safeParse(input);
    if (!parsed.success) return failure("VALIDATION_ERROR", "Choose one of the drawn avatars.");
    try {
      await this.repository.setOwnAvatarPreset(parsed.data.preset);
      return success({ avatarUrl: this.repository.avatarUrl(null, parsed.data.preset) });
    } catch {
      return failure("PROFILE_UNAVAILABLE", "Your avatar could not be saved. Try again.");
    }
  }

  async readPublic(actor: ProfileActor | null, publicId: string): Promise<ReadPublicProfileResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to view member profiles.");
    if (!actor.emailVerified) return failure("EMAIL_NOT_VERIFIED", "Verify your email first.");
    if (!UUID.test(publicId)) return failure("PROFILE_NOT_FOUND", "This profile does not exist.");
    try {
      const profile = await this.repository.readPublicProfile(publicId);
      return profile
        ? success(profile)
        : failure("PROFILE_NOT_FOUND", "This profile does not exist.");
    } catch {
      return failure("PROFILE_UNAVAILABLE", "This profile is temporarily unavailable.");
    }
  }
}
