import { z } from "zod";
import type { WantedSummary } from "./marketplace";
import type { OperationResult } from "./operation-result";
import type { MemberBadge } from "./console";

export type ProfileOperationCode =
  | "AUTH_REQUIRED"
  | "EMAIL_NOT_VERIFIED"
  | "VALIDATION_ERROR"
  | "PROFILE_NOT_FOUND"
  | "AVATAR_NOT_UPLOADED"
  | "PROFILE_UNAVAILABLE";

/** Avatar object keys live in the public `avatars` bucket under the owner's public id. */
export const AVATAR_OBJECT_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/avatar-[0-9]{10,16}\.webp$/;
export const AVATAR_MAX_BYTES = 524_288;
export const AVATAR_SIZE_PX = 512;

export const updateProfileInputSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  bio: z.string().trim().max(160).optional(),
});

export type UpdateProfileInput = z.input<typeof updateProfileInputSchema>;

export const setAvatarInputSchema = z.object({
  objectKey: z.string().regex(AVATAR_OBJECT_KEY).nullable(),
});

/** One of the twelve drawn characters (0 to 11), or null for the default. */
export const setAvatarPresetInputSchema = z.object({
  preset: z.number().int().min(0).max(11).nullable(),
});

/**
 * What any verified member may see about another: display name, avatar, bio,
 * joined date, badges and the Wanteds they posted. Never an email address,
 * verification evidence, claims or who backed what.
 */
export interface PublicProfile {
  publicId: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  joinedAt: string;
  institutionName: string | null;
  institutionVerified: boolean;
  /** The Owner-awarded badge, if any. */
  badge?: MemberBadge | null;
  wanted: WantedSummary[];
}

export type UpdateProfileResult = OperationResult<
  { displayName: string; bio: string | null },
  ProfileOperationCode
>;
export type AvatarUploadResult = OperationResult<
  { objectKey: string; signedUrl: string; token: string },
  ProfileOperationCode
>;
export type SetAvatarResult = OperationResult<{ avatarUrl: string | null }, ProfileOperationCode>;
export type ReadPublicProfileResult = OperationResult<PublicProfile, ProfileOperationCode>;
