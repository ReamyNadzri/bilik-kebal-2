import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAvatarUrl } from "./avatars";

const client = {
  storage: {
    from: () => ({
      getPublicUrl: (key: string) => ({ data: { publicUrl: `https://storage.test/${key}` } }),
    }),
  },
} as unknown as SupabaseClient;

const google = "https://img.clerk.com/eyJ0eXBlIjoicHJveHkifQ";

describe("resolveAvatarUrl", () => {
  it("prefers the uploaded photo, then the drawn avatar, then the Google photo", () => {
    expect(resolveAvatarUrl(client, "p/avatar-1.webp", 3, google)).toBe(
      "https://storage.test/p/avatar-1.webp",
    );
    expect(resolveAvatarUrl(client, null, 3, google)).toBe("/brand/avatar-3.webp");
    expect(resolveAvatarUrl(client, null, null, google)).toBe(google);
    expect(resolveAvatarUrl(client, null, null, null)).toBeNull();
  });

  it("never shows a link that is not a Clerk or Google image", () => {
    expect(resolveAvatarUrl(client, null, null, "https://evil.test/pixel.png")).toBeNull();
    expect(resolveAvatarUrl(client, null, null, "http://img.clerk.com/x")).toBeNull();
    expect(resolveAvatarUrl(client, null, null, "https://lh3.googleusercontent.com/a/photo")).toBe(
      "https://lh3.googleusercontent.com/a/photo",
    );
  });
});
