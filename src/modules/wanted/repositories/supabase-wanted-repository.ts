import type { SupabaseClient } from "@supabase/supabase-js";
import type { ValidatedWantedDraftInput } from "@/contracts/marketplace";
import type { Database } from "@/lib/supabase/database.types";
import type { DuplicateCandidate } from "../domain/duplicate-ranking";
import type { PersistWantedDraft, StoredWantedDraft, WantedRepository } from "./wanted-repository";

type Client = SupabaseClient<Database>;

function rpcArgs(values: ValidatedWantedDraftInput) {
  return {
    academic_session_id: values.academicSessionId,
    campus_id: values.campusId,
    course_id: values.courseId,
    description: values.description,
    duration_days: values.durationDays,
    faculty_id: values.facultyId,
    language_id: values.languageId,
    programme_id: values.programmeId,
    resource_type_id: values.resourceTypeId,
    tag_ids: values.tagIds,
    title: values.title,
  };
}

export class SupabaseWantedRepository implements WantedRepository {
  constructor(private readonly client: Client) {}

  async taxonomyMatchesInstitution(
    institutionId: string,
    values: ValidatedWantedDraftInput,
  ): Promise<boolean> {
    const checks = await Promise.all([
      this.client
        .from("campuses")
        .select("id")
        .eq("id", values.campusId)
        .eq("institution_id", institutionId)
        .eq("active", true)
        .maybeSingle(),
      this.client
        .from("faculties")
        .select("id")
        .eq("id", values.facultyId)
        .eq("institution_id", institutionId)
        .eq("active", true)
        .maybeSingle(),
      this.client
        .from("programmes")
        .select("id")
        .eq("id", values.programmeId)
        .eq("faculty_id", values.facultyId)
        .eq("institution_id", institutionId)
        .eq("active", true)
        .maybeSingle(),
      this.client
        .from("courses")
        .select("id")
        .eq("id", values.courseId)
        .eq("programme_id", values.programmeId)
        .eq("institution_id", institutionId)
        .eq("active", true)
        .maybeSingle(),
      this.client
        .from("academic_sessions")
        .select("id")
        .eq("id", values.academicSessionId)
        .eq("institution_id", institutionId)
        .eq("active", true)
        .maybeSingle(),
      this.client
        .from("resource_types")
        .select("id")
        .eq("id", values.resourceTypeId)
        .eq("active", true)
        .maybeSingle(),
      this.client
        .from("languages")
        .select("id")
        .eq("id", values.languageId)
        .eq("active", true)
        .maybeSingle(),
    ]);
    if (checks.some(({ data, error }) => error || !data)) return false;
    if (values.tagIds.length === 0) return true;
    const tags = await this.client
      .from("tags")
      .select("id")
      .in("id", values.tagIds)
      .eq("active", true);
    return !tags.error && tags.data.length === values.tagIds.length;
  }

  async createDraft(input: PersistWantedDraft): Promise<StoredWantedDraft> {
    const { data: draftId, error } = await this.client.rpc(
      "create_wanted_draft",
      rpcArgs(input.values),
    );
    if (error) throw error;
    const draft = await this.findDraft(draftId, input.commissionerUserId);
    if (!draft) throw new Error("Created Wanted draft could not be read");
    return draft;
  }

  async findDraft(draftId: string, commissionerUserId: string): Promise<StoredWantedDraft | null> {
    const [draftResult, tagsResult] = await Promise.all([
      this.client
        .from("wanted_requests")
        .select(
          "id, commissioner_user_id, institution_id, campus_id, faculty_id, programme_id, course_id, academic_session_id, resource_type_id, language_id, title, description, requested_duration_days, status, updated_at",
        )
        .eq("id", draftId)
        .eq("commissioner_user_id", commissionerUserId)
        .maybeSingle(),
      this.client.from("wanted_request_tags").select("tag_id").eq("wanted_request_id", draftId),
    ]);
    if (draftResult.error || tagsResult.error) throw draftResult.error ?? tagsResult.error;
    const row = draftResult.data;
    if (!row) return null;
    return {
      commissionerUserId: row.commissioner_user_id,
      id: row.id,
      institutionId: row.institution_id,
      state: row.status === "draft" ? "draft" : "awaiting_payment",
      updatedAt: row.updated_at,
      values: {
        academicSessionId: row.academic_session_id,
        campusId: row.campus_id,
        courseId: row.course_id,
        description: row.description,
        durationDays: row.requested_duration_days as 7 | 14 | 30,
        facultyId: row.faculty_id,
        languageId: row.language_id,
        policyAccepted: true,
        programmeId: row.programme_id,
        resourceTypeId: row.resource_type_id,
        tagIds: tagsResult.data.map(({ tag_id }) => tag_id),
        title: row.title,
      },
    };
  }

  async updateDraft(input: PersistWantedDraft & { draftId: string }): Promise<StoredWantedDraft> {
    const { error } = await this.client.rpc("update_wanted_draft", {
      draft_id: input.draftId,
      ...rpcArgs(input.values),
    });
    if (error) throw error;
    const draft = await this.findDraft(input.draftId, input.commissionerUserId);
    if (!draft) throw new Error("Updated Wanted draft could not be read");
    return draft;
  }

  async listDuplicateCandidates(draft: StoredWantedDraft): Promise<DuplicateCandidate[]> {
    const wanted = await this.client
      .from("wanted_requests")
      .select(
        "public_id, title, course_id, campus_id, resource_type_id, academic_session_id, status, published_at, closes_at",
      )
      .eq("institution_id", draft.institutionId)
      .in("status", ["open", "reviewing"])
      .neq("id", draft.id)
      .limit(50);
    if (wanted.error) throw wanted.error;
    if (wanted.data.length === 0) return [];

    const unique = (values: string[]) => [...new Set(values)];
    const [courses, campuses, resourceTypes, sessions] = await Promise.all([
      this.client
        .from("courses")
        .select("id, code, name")
        .in("id", unique(wanted.data.map(({ course_id }) => course_id))),
      this.client
        .from("campuses")
        .select("id, name")
        .in("id", unique(wanted.data.map(({ campus_id }) => campus_id))),
      this.client
        .from("resource_types")
        .select("id, name")
        .in("id", unique(wanted.data.map(({ resource_type_id }) => resource_type_id))),
      this.client
        .from("academic_sessions")
        .select("id, name")
        .in("id", unique(wanted.data.map(({ academic_session_id }) => academic_session_id))),
    ]);
    if (courses.error || campuses.error || resourceTypes.error || sessions.error) {
      throw courses.error ?? campuses.error ?? resourceTypes.error ?? sessions.error;
    }
    const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((row) => [row.id, row]));
    const courseById = byId(courses.data);
    const campusById = byId(campuses.data);
    const typeById = byId(resourceTypes.data);
    const sessionById = byId(sessions.data);

    return wanted.data.flatMap((row) => {
      const course = courseById.get(row.course_id);
      const campus = campusById.get(row.campus_id);
      const resourceType = typeById.get(row.resource_type_id);
      const session = sessionById.get(row.academic_session_id);
      if (!course || !campus || !resourceType || !session || !row.published_at || !row.closes_at) {
        return [];
      }
      return [
        {
          academicSessionId: row.academic_session_id,
          courseId: row.course_id,
          resourceTypeId: row.resource_type_id,
          wanted: {
            backerCount: 0,
            campus: campus.name,
            campusId: row.campus_id,
            closesAt: row.closes_at,
            courseCode: course.code,
            courseId: row.course_id,
            courseName: course.name,
            grossBountySen: 0 as never,
            id: row.public_id,
            postedAt: row.published_at,
            resourceType: resourceType.name,
            resourceTypeId: row.resource_type_id,
            session: session.name,
            sessionId: row.academic_session_id,
            status: row.status === "reviewing" ? ("reviewing" as const) : ("open" as const),
            title: row.title,
          },
        },
      ];
    });
  }

  async storeDuplicateCheck(input: {
    draftId: string;
    tokenHash: string;
    criteriaHash: string;
    expiresAt: string;
  }): Promise<void> {
    const { error } = await this.client.rpc("record_wanted_duplicate_check", {
      criteria_hash_hex: input.criteriaHash,
      draft_id: input.draftId,
      expires_at: input.expiresAt,
      token_hash_hex: input.tokenHash,
    });
    if (error) throw error;
  }

  async preparePublication(): Promise<"prepared" | "required" | "expired"> {
    throw new Error("The Phase 3B trusted money adapter is not installed");
  }
}
