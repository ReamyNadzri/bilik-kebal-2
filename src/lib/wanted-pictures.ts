import type { SupabaseClient } from "@supabase/supabase-js";
import { WANTED_PICTURE_PRESET_COUNT, type WantedPicture } from "@/contracts/wanted-pictures";

/*
 * `wanted_pictures` arrived after the generated database types
 * (migration 202610120001), so it is read through an untyped client until the
 * types are regenerated.
 */
type Untyped = SupabaseClient;

interface PictureRow {
  wanted_request_id: string;
  preset: number | null;
  object_key: string | null;
}

/** Public URL of an uploaded Wanted picture. */
export function wantedPictureUrl(client: SupabaseClient<never> | SupabaseClient, key: string) {
  return (client as Untyped).storage.from("wanted-pictures").getPublicUrl(key).data.publicUrl;
}

/**
 * The chosen pictures of these Wanteds, by internal id. A Wanted without one
 * is absent from the map and shows its automatic drawing. A failed read is an
 * empty map: a picture is decoration, and the Board must not go down for it.
 */
export async function readWantedPictures(
  client: SupabaseClient<never> | SupabaseClient,
  wantedIds: readonly string[],
): Promise<Map<string, WantedPicture>> {
  const pictures = new Map<string, WantedPicture>();
  if (wantedIds.length === 0) return pictures;
  try {
    const { data, error } = await (client as Untyped)
      .from("wanted_pictures")
      .select("wanted_request_id, preset, object_key")
      .in("wanted_request_id", [...wantedIds]);
    if (error) return pictures;
    for (const row of (data ?? []) as PictureRow[]) {
      if (row.object_key) {
        pictures.set(row.wanted_request_id, {
          kind: "upload",
          url: wantedPictureUrl(client, row.object_key),
        });
      } else if (
        typeof row.preset === "number" &&
        row.preset >= 0 &&
        row.preset < WANTED_PICTURE_PRESET_COUNT
      ) {
        pictures.set(row.wanted_request_id, { kind: "preset", preset: row.preset });
      }
    }
  } catch {
    // Decoration only; see above.
  }
  return pictures;
}
