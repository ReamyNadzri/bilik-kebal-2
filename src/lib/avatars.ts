import type { SupabaseClient } from "@supabase/supabase-js";

/** The twelve drawn characters a member may choose instead of a photo. */
export const AVATAR_PRESET_COUNT = 12;

export function presetAvatarPath(preset: number): string {
  return `/brand/avatar-${preset}.webp`;
}

/**
 * Hosts a Google profile photo link may point at: Clerk's image proxy, or
 * Google itself. The database refuses any other (migration 202610170001).
 */
const EXTERNAL_AVATAR = /^https:\/\/(img\.clerk\.com|lh3\.googleusercontent\.com)\//;

export function isExternalAvatarUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && url.length <= 2048 && EXTERNAL_AVATAR.test(url);
}

/**
 * A member's picture URL, in order: their uploaded photo from the public
 * `avatars` bucket, their chosen drawn character, the Google photo they signed
 * in with, else null (the default drawing).
 */
export function resolveAvatarUrl(
  client: SupabaseClient<never> | SupabaseClient,
  objectKey: string | null | undefined,
  preset: number | null | undefined,
  externalUrl?: string | null,
): string | null {
  if (objectKey) {
    return (client as SupabaseClient).storage.from("avatars").getPublicUrl(objectKey).data
      .publicUrl;
  }
  if (typeof preset === "number" && preset >= 0 && preset < AVATAR_PRESET_COUNT) {
    return presetAvatarPath(preset);
  }
  if (isExternalAvatarUrl(externalUrl)) return externalUrl;
  return null;
}
