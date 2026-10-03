import type { SupabaseClient } from "@supabase/supabase-js";
import type { WantedChangeLock, WantedChangeWindow, WantedKind } from "@/contracts/marketplace";
import type { Database } from "@/lib/supabase/database";
import type {
  PublishedWantedChange,
  StoredEditableDetails,
  WantedPosterRepository,
} from "../services/wanted-poster-service";

/** The poster-change RPCs of migrations 202610130002 and 202610200004. */
export class SupabaseWantedPosterRepository implements WantedPosterRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async readChangeWindow(publicId: string): Promise<WantedChangeWindow | null> {
    const { data, error } = await this.client.rpc("my_wanted_change_window", {
      target_public_id: publicId,
    });
    if (error) throw error;
    const row = data?.[0];
    if (!row) return null;
    return {
      editableUntil: new Date(row.editable_until).toISOString(),
      lockedReason: row.locked_reason as WantedChangeLock | null,
    };
  }

  async readEditableDetails(
    publicId: string,
    posterUserId: string,
  ): Promise<StoredEditableDetails | null> {
    const client = this.client;
    const { data: row, error } = await client
      .from("wanted_requests")
      .select(
        "id, kind, title, description, campus_id, faculty_id, programme_id, course_id, academic_session_id, resource_type_id, language_id, last_seen_location",
      )
      .eq("public_id", publicId)
      .eq("commissioner_user_id", posterUserId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    const [tags, course] = await Promise.all([
      client.from("wanted_request_tags").select("tag_id").eq("wanted_request_id", row.id),
      row.course_id
        ? client.from("courses").select("code").eq("id", row.course_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (tags.error || course.error) throw tags.error ?? course.error;
    return {
      kind: row.kind as WantedKind,
      title: row.title,
      description: row.description,
      campusId: row.campus_id,
      facultyId: row.faculty_id,
      programmeId: row.programme_id,
      courseCode: course.data?.code ?? null,
      courseId: row.course_id,
      academicSessionId: row.academic_session_id,
      resourceTypeId: row.resource_type_id,
      languageId: row.language_id,
      lastSeenLocation: row.last_seen_location,
      tagIds: tags.data.map(({ tag_id }) => tag_id),
    };
  }

  async ensureCourse(programmeId: string, courseCode: string): Promise<string | null> {
    const { data, error } = await this.client.rpc("ensure_course", {
      target_code: courseCode,
      target_programme_id: programmeId,
    });
    if (error?.message === "course_inactive") return null;
    if (error) throw error;
    return data;
  }

  async updatePublishedWanted(publicId: string, change: PublishedWantedChange) {
    const { error } = await this.client.rpc("update_own_published_wanted_details", {
      target_public_id: publicId,
      new_title: change.title,
      new_description: change.description,
      new_campus_id: change.campusId,
      new_faculty_id: change.facultyId,
      new_programme_id: change.programmeId,
      new_course_id: change.courseId,
      new_academic_session_id: change.academicSessionId,
      new_resource_type_id: change.resourceTypeId,
      new_language_id: change.languageId,
      new_last_seen_location: change.lastSeenLocation,
      new_tag_ids: change.tagIds,
    });
    if (error) throw error;
  }

  async withdrawWanted(publicId: string): Promise<number> {
    const { data, error } = await this.client.rpc("withdraw_own_wanted", {
      target_public_id: publicId,
    });
    if (error) throw error;
    return Number(data ?? 0);
  }
}
