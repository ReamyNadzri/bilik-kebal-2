import { cookies } from "next/headers";
import { cache } from "react";
import { UNIVERSITY_COOKIE, type UniversityChoice } from "@/contracts/universities";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { chooseUniversity } from "../domain/university-choice";
import { loadAccountContext } from "./identity-read";

/**
 * The university this request's screens show, read once per render.
 *
 * The list is read with the service client because a signed-out reader has
 * no RLS path to `institutions`, and the map and homepage name universities
 * to everyone. Only the id, slug and names of active universities are read,
 * which the campus names on the public map already disclose.
 *
 * A failed read degrades to null (no filter) rather than failing the page.
 */
export const loadUniversityChoice = cache(async (): Promise<UniversityChoice | null> => {
  try {
    const [institutions, signedIn, jar] = await Promise.all([
      createSupabaseAdminClient()
        .from("institutions")
        .select("id, slug, name, short_name")
        .eq("active", true)
        .order("created_at"),
      loadAccountContext(),
      cookies(),
    ]);
    if (institutions.error) return null;
    const account = signedIn?.record ?? null;
    return chooseUniversity(
      institutions.data.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        shortName: row.short_name ?? row.name,
      })),
      account?.institutionVerificationState === "verified"
        ? (account.institution?.id ?? null)
        : null,
      jar.get(UNIVERSITY_COOKIE)?.value ?? null,
    );
  } catch {
    return null;
  }
});
