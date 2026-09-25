import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketplaceTaxonomy, TaxonomyItem } from "@/contracts/marketplace";
import type { Database } from "@/lib/supabase/database.types";
import type { TaxonomyRepository } from "./taxonomy-repository";

function item(row: { id: string; slug: string; name: string }): TaxonomyItem {
  return { id: row.id, slug: row.slug, label: row.name };
}

export class SupabaseTaxonomyRepository implements TaxonomyRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listActive(institutionId: string | null): Promise<MarketplaceTaxonomy> {
    const campusesQuery = this.client
      .from("campuses")
      .select("id, slug, name, region_open")
      .eq("active", true)
      .order("sort_order")
      .order("name");
    const facultiesQuery = this.client
      .from("faculties")
      .select("id, slug, name")
      .eq("active", true)
      .order("sort_order")
      .order("name");
    const programmesQuery = this.client
      .from("programmes")
      .select("id, slug, name, faculty_id")
      .eq("active", true)
      .order("sort_order")
      .order("name");
    const coursesQuery = this.client
      .from("courses")
      .select("id, slug, code, name, programme_id")
      .eq("active", true)
      .order("sort_order")
      .order("code");
    const sessionsQuery = this.client
      .from("academic_sessions")
      .select("id, slug, name")
      .eq("active", true)
      .order("sort_order")
      .order("name");

    if (institutionId !== null) {
      campusesQuery.eq("institution_id", institutionId);
      facultiesQuery.eq("institution_id", institutionId);
      programmesQuery.eq("institution_id", institutionId);
      coursesQuery.eq("institution_id", institutionId);
      sessionsQuery.eq("institution_id", institutionId);
    }

    const [
      campuses,
      faculties,
      programmes,
      courses,
      academicSessions,
      resourceTypes,
      languages,
      tags,
    ] = await Promise.all([
      campusesQuery,
      facultiesQuery,
      programmesQuery,
      coursesQuery,
      sessionsQuery,
      this.client
        .from("resource_types")
        .select("id, slug, name")
        .eq("active", true)
        .order("sort_order")
        .order("name"),
      this.client
        .from("languages")
        .select("id, slug, name")
        .eq("active", true)
        .order("sort_order")
        .order("name"),
      this.client
        .from("tags")
        .select("id, slug, name")
        .eq("active", true)
        .order("sort_order")
        .order("name"),
    ]);

    const results = [
      campuses,
      faculties,
      programmes,
      courses,
      academicSessions,
      resourceTypes,
      languages,
      tags,
    ];
    if (results.some((result) => result.error)) {
      throw new Error("Taxonomy read failed");
    }

    return {
      provenance: "reviewed_configuration",
      campuses: (campuses.data ?? []).map((row) => ({ ...item(row), regionOpen: row.region_open })),
      faculties: (faculties.data ?? []).map(item),
      programmes: (programmes.data ?? []).map((row) => ({
        ...item(row),
        facultyId: row.faculty_id,
      })),
      courses: (courses.data ?? []).map((row) => ({
        ...item(row),
        code: row.code,
        programmeId: row.programme_id,
      })),
      academicSessions: (academicSessions.data ?? []).map(item),
      resourceTypes: (resourceTypes.data ?? []).map(item),
      languages: (languages.data ?? []).map(item),
      tags: (tags.data ?? []).map(item),
    };
  }
}
