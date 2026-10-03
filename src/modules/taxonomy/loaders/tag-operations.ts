import { z } from "zod";
import { failure, success, type OperationResult } from "@/contracts/operation-result";
import type { TaxonomyItem } from "@/contracts/marketplace";
import { getRequestSupabaseClient } from "@/lib/supabase/server";

/**
 * A tag a member types on Post a Wanted. Tags are open (request, 2026-10-02):
 * any member verified at an institution may add one, without a Sheriff.
 * `ensure_tag` checks who is asking, validates the name and matches an
 * existing tag case-insensitively; a tag a Sheriff switched off stays off.
 */
export const addTagInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[\p{L}\p{N}][\p{L}\p{N} .+#&-]*$/u),
});

export type AddTagCode =
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "TAG_UNAVAILABLE"
  | "INSTITUTION_VERIFICATION_REQUIRED"
  | "TAXONOMY_UNAVAILABLE";

export type AddTagResult = OperationResult<TaxonomyItem, AddTagCode>;

const TAG_RULE = "Use 2 to 30 letters, numbers or spaces, for example Calculus or Past Year.";

function reason(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
}

export async function addTag(input: unknown): Promise<AddTagResult> {
  const parsed = addTagInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure("VALIDATION_ERROR", TAG_RULE, { name: [TAG_RULE] });
  }
  try {
    const client = await getRequestSupabaseClient();
    const { data, error } = await client.rpc("ensure_tag", { target_name: parsed.data.name });
    if (error) {
      const why = reason(error);
      if (why.includes("tag_invalid")) return failure("VALIDATION_ERROR", TAG_RULE);
      if (why.includes("tag_unavailable")) {
        return failure("TAG_UNAVAILABLE", "That tag is not available. Try another word.");
      }
      if (why.includes("wanted_actor_not_eligible")) {
        return failure(
          "INSTITUTION_VERIFICATION_REQUIRED",
          "Adding a tag needs institution verification.",
        );
      }
      return failure("TAXONOMY_UNAVAILABLE", "The tag could not be added. Try again.");
    }
    const id = String(data);
    const row = await client.from("tags").select("slug, name").eq("id", id).maybeSingle();
    return success({
      id,
      slug: row.data?.slug ?? id,
      label: row.data?.name ?? parsed.data.name,
    });
  } catch {
    return failure("TAXONOMY_UNAVAILABLE", "The tag could not be added. Try again.");
  }
}
