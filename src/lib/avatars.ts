import type { SupabaseClient } from "@supabase/supabase-js";

/** The twelve drawn characters a member may choose instead of a photo. */
export const AVATAR_PRESET_COUNT = 12;

export function presetAvatarPath(preset: number): string {
  return `/brand/avatar-${preset}.webp`;
}

/**
 * A member's picture URL: their uploaded photo from the public `avatars`
 * bucket, else their chosen drawn character, else null (the default drawing).
 */
export function resolveAvatarUrl(
  client: SupabaseClient<never> | SupabaseClient,
  objectKey: string | null | undefined,
  preset: number | null | undefined,
): string | null {
  if (objectKey) {
    return (client as SupabaseClient).storage.from("avatars").getPublicUrl(objectKey).data
      .publicUrl;
  }
  if (typeof preset === "number" && preset >= 0 && preset < AVATAR_PRESET_COUNT) {
    return presetAvatarPath(preset);
  }
  return null;
}
