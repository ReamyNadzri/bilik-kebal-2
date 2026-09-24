import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CampusRegion,
  ListWantedQuery,
  Sen,
  ValidatedWantedDraftInput,
  WantedDetail,
  WantedKind,
  WantedReply,
  WantedSummary,
} from "@/contracts/marketplace";
import type { Database } from "@/lib/supabase/database.types";
import type { DuplicateCandidate } from "../domain/duplicate-ranking";
import { sortWantedSummaries, wantedDisplayStatus } from "../domain/wanted-read-query";
import type { PersistWantedDraft, StoredWantedDraft, WantedRepository } from "./wanted-repository";

type Client = SupabaseClient<Database>;
type WantedRow = Database["public"]["Tables"]["wanted_requests"]["Row"];

const PUBLIC_STATUSES = ["open", "reviewing", "expired", "fulfilled", "closed"] as const;
const KIND_LABEL: Record<WantedKind, string> = {
  academic: "Academic resource",
  missing_item: "Missing item",
  discussion: "Discussion",
};

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

const present = (values: ReadonlyArray<string | null>): string[] => [
  ...new Set(values.filter((value): value is string => value !== null)),
];

export class SupabaseWantedRepository implements WantedRepository {
  constructor(private readonly client: Client) {}

  /** Public URL of an avatar object, or null. The bucket is public by design. */
  avatarUrl(objectKey: string | null): string | null {
    if (!objectKey) return null;
    return this.client.storage.from("avatars").getPublicUrl(objectKey).data.publicUrl;
  }

  async listPublicWanted(query: ListWantedQuery): Promise<WantedSummary[]> {
    let request = this.client
      .from("wanted_requests")
      .select("*")
      .in("status", ["open", "reviewing"])
      .order("published_at", { ascending: false })
      .limit(100);
    if (query.status) request = request.eq("status", query.status);
    if (query.kind) request = request.eq("kind", query.kind);
    if (query.campusId) request = request.eq("campus_id", query.campusId);
    if (query.courseId) request = request.eq("course_id", query.courseId);
    if (query.resourceTypeId) request = request.eq("resource_type_id", query.resourceTypeId);
    if (query.academicSessionId)
      request = request.eq("academic_session_id", query.academicSessionId);
    if (query.query) request = request.ilike("title", `%${query.query.replace(/[%_]/g, "\\$&")}%`);
    const { data, error } = await request;
    if (error) throw error;
    return sortWantedSummaries(await this.toSummaries(data ?? []), query.sort);
  }

  /** Published Wanteds by internal id, newest first (profiles, archive). */
  async listWantedByIds(ids: readonly string[]): Promise<WantedSummary[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.client
      .from("wanted_requests")
      .select("*")
      .in("id", [...ids])
      .in("status", [...PUBLIC_STATUSES])
      .order("published_at", { ascending: false });
    if (error) throw error;
    return this.toSummaries(data ?? []);
  }

  /** Fulfilled and resolved Wanteds: the Archive. */
  async listArchivedWanted(limit = 60): Promise<WantedSummary[]> {
    const { data, error } = await this.client
      .from("wanted_requests")
      .select("*")
      .in("status", ["fulfilled", "closed"])
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return this.toSummaries(data ?? []);
  }

  async readPublicWanted(publicId: string): Promise<WantedDetail | null> {
    const { data: row, error } = await this.client
      .from("wanted_requests")
      .select("*")
      .eq("public_id", publicId)
      .in("status", [...PUBLIC_STATUSES])
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    const summaries = await this.toSummaries([row]);
    const summary = summaries[0];
    if (!summary) return null;
    const optionalName = async (
      table: "faculties" | "programmes" | "languages",
      id: string | null,
    ) => {
      if (!id) return { data: null, error: null };
      return this.client.from(table).select("name").eq("id", id).maybeSingle();
    };
    const [faculty, programme, language, tags, events, profile, membership] = await Promise.all([
      optionalName("faculties", row.faculty_id),
      optionalName("programmes", row.programme_id),
      optionalName("languages", row.language_id),
      this.client.from("wanted_request_tags").select("tag_id").eq("wanted_request_id", row.id),
      this.client
        .from("wanted_public_events")
        .select("id, occurred_at, summary")
        .eq("wanted_request_id", row.id)
        .order("occurred_at", { ascending: false })
        .limit(20),
      this.client
        .from("profiles")
        .select("display_name, public_id, avatar_object_key, created_at")
        .eq("user_id", row.commissioner_user_id)
        .maybeSingle(),
      this.client
        .from("institution_memberships")
        .select("verification_state")
        .eq("user_id", row.commissioner_user_id)
        .eq("institution_id", row.institution_id)
        .maybeSingle(),
    ]);
    const failed =
      faculty.error ??
      programme.error ??
      language.error ??
      tags.error ??
      events.error ??
      profile.error ??
      membership.error;
    if (failed) throw failed;
    const tagIds = (tags.data ?? []).map((x: { tag_id: string }) => x.tag_id);
    const tagRows = tagIds.length
      ? await this.client.from("tags").select("name").in("id", tagIds)
      : { data: [], error: null };
    if (tagRows.error) throw tagRows.error;
    return {
      ...summary,
      description: row.description,
      faculty: faculty.data?.name ?? "",
      programme: programme.data?.name ?? "",
      language: language.data?.name ?? "",
      tags: (tagRows.data ?? []).map((x: { name: string }) => x.name),
      commissioner: {
        publicId: profile.data?.public_id ?? null,
        displayName: profile.data?.display_name ?? "VAULTIX member",
        avatarUrl: this.avatarUrl(profile.data?.avatar_object_key ?? null),
        joinedAt: profile.data?.created_at ?? null,
        emailVerified: true,
        institutionVerified: membership.data?.verification_state === "verified",
      },
      feeRateBasisPoints: row.fee_rate_basis_points_snapshot ?? 0,
      policyVersion: row.policy_version_snapshot ?? "",
      activity: (events.data ?? []).map(
        (x: { id: string; occurred_at: string; summary: string }) => ({
          id: x.id,
          at: x.occurred_at,
          summary: x.summary,
        }),
      ),
      similarIds: [],
    };
  }

  private async toSummaries(rows: WantedRow[]): Promise<WantedSummary[]> {
    if (!rows.length) return [];
    const [courses, campuses, types, sessions, contributions] = await Promise.all([
      this.client
        .from("courses")
        .select("id, code, name")
        .in("id", present(rows.map((x) => x.course_id))),
      this.client
        .from("campuses")
        .select("id, name")
        .in("id", present(rows.map((x) => x.campus_id))),
      this.client
        .from("resource_types")
        .select("id, name")
        .in("id", present(rows.map((x) => x.resource_type_id))),
      this.client
        .from("academic_sessions")
        .select("id, name")
        .in("id", present(rows.map((x) => x.academic_session_id))),
      this.client
        .from("contributions")
        .select("wanted_request_id, amount_sen, contributor_user_id")
        .in(
          "wanted_request_id",
          rows.map((x) => x.id),
        ),
    ]);
    if (courses.error || campuses.error || types.error || sessions.error || contributions.error)
      throw courses.error ?? campuses.error ?? types.error ?? sessions.error ?? contributions.error;
    const by = <T extends { id: string }>(values: T[]) => new Map(values.map((x) => [x.id, x]));
    const courseById = by(courses.data ?? []);
    const campusById = by(campuses.data ?? []);
    const typeById = by(types.data ?? []);
    const sessionById = by(sessions.data ?? []);
    const now = Date.now();
    const contributionRows = contributions.data ?? [];
    return rows.flatMap((row) => {
      const campus = campusById.get(row.campus_id);
      if (!campus || !row.published_at || !row.closes_at) return [];
      const academic = row.kind === "academic";
      const course = row.course_id ? courseById.get(row.course_id) : undefined;
      const type = row.resource_type_id ? typeById.get(row.resource_type_id) : undefined;
      const session = row.academic_session_id
        ? sessionById.get(row.academic_session_id)
        : undefined;
      if (academic && (!course || !type || !session)) return [];
      const cs = contributionRows.filter((x) => x.wanted_request_id === row.id);
      const bounty = cs.reduce((n, x) => n + Number(x.amount_sen), 0) as Sen;
      const status = wantedDisplayStatus(row.status, row.closes_at, bounty, now);
      const summary: WantedSummary = {
        id: row.public_id,
        kind: row.kind,
        isFree: row.is_free,
        title: row.title,
        courseCode: course?.code ?? "",
        courseName: course?.name ?? "",
        courseId: row.course_id ?? "",
        campus: campus.name,
        campusId: row.campus_id,
        resourceType: type?.name ?? KIND_LABEL[row.kind],
        resourceTypeId: row.resource_type_id ?? "",
        session: session?.name ?? "",
        sessionId: row.academic_session_id ?? "",
        grossBountySen: bounty,
        backerCount: new Set(cs.map((x) => x.contributor_user_id)).size,
        status,
        postedAt: row.published_at,
        closesAt: row.closes_at,
        lastSeenLocation: row.last_seen_location,
      };
      return [summary];
    });
  }

  /** Every active campus with its region state and live open-Wanted totals. */
  async listCampusRegions(): Promise<CampusRegion[]> {
    const [campuses, wanted] = await Promise.all([
      this.client
        .from("campuses")
        .select("id, name, region_open, latitude, longitude, map_x, map_y")
        .eq("active", true)
        .order("sort_order")
        .order("name"),
      this.client
        .from("wanted_requests")
        .select("id, campus_id")
        .in("status", ["open", "reviewing"]),
    ]);
    if (campuses.error || wanted.error) throw campuses.error ?? wanted.error;
    const ids = (wanted.data ?? []).map((row) => row.id);
    const contributions = ids.length
      ? await this.client
          .from("contributions")
          .select("wanted_request_id, amount_sen")
          .in("wanted_request_id", ids)
      : { data: [], error: null };
    if (contributions.error) throw contributions.error;
    const campusOf = new Map((wanted.data ?? []).map((row) => [row.id, row.campus_id]));
    const counts = new Map<string, number>();
    const totals = new Map<string, number>();
    for (const row of wanted.data ?? [])
      counts.set(row.campus_id, (counts.get(row.campus_id) ?? 0) + 1);
    for (const row of contributions.data ?? []) {
      const campusId = campusOf.get(row.wanted_request_id);
      if (campusId) totals.set(campusId, (totals.get(campusId) ?? 0) + Number(row.amount_sen));
    }
    return (campuses.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      regionOpen: row.region_open,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      mapX: row.map_x === null ? null : Number(row.map_x),
      mapY: row.map_y === null ? null : Number(row.map_y),
      openWantedCount: row.region_open ? (counts.get(row.id) ?? 0) : 0,
      openBountySen: (row.region_open ? (totals.get(row.id) ?? 0) : 0) as Sen,
    }));
  }

  async listReplies(publicId: string): Promise<WantedReply[]> {
    const { data: wanted, error } = await this.client
      .from("wanted_requests")
      .select("id")
      .eq("public_id", publicId)
      .in("kind", ["missing_item", "discussion"])
      .in("status", ["open", "closed"])
      .maybeSingle();
    if (error) throw error;
    if (!wanted) return [];
    const replies = await this.client
      .from("wanted_replies")
      .select("id, body, created_at, author_user_id")
      .eq("wanted_request_id", wanted.id)
      .is("hidden_at", null)
      .order("created_at", { ascending: true })
      .limit(200);
    if (replies.error) throw replies.error;
    const authorIds = present((replies.data ?? []).map((row) => row.author_user_id));
    const authors = authorIds.length
      ? await this.client
          .from("profiles")
          .select("user_id, public_id, display_name, avatar_object_key")
          .in("user_id", authorIds)
      : { data: [], error: null };
    if (authors.error) throw authors.error;
    const authorById = new Map((authors.data ?? []).map((row) => [row.user_id, row]));
    return (replies.data ?? []).map((row) => {
      const author = authorById.get(row.author_user_id);
      return {
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        author: {
          publicId: author?.public_id ?? "",
          displayName: author?.display_name ?? "VAULTIX member",
          avatarUrl: this.avatarUrl(author?.avatar_object_key ?? null),
        },
      };
    });
  }

  async postReply(publicId: string, body: string): Promise<string> {
    const { data, error } = await this.client.rpc("post_wanted_reply", {
      reply_body: body,
      target_public_id: publicId,
    });
    if (error) throw error;
    return data;
  }

  async resolveCommunityWanted(publicId: string): Promise<void> {
    const { error } = await this.client.rpc("resolve_own_community_wanted", {
      target_public_id: publicId,
    });
    if (error) throw error;
  }

  async publishCommunityWanted(input: {
    kind: "missing_item" | "discussion";
    campusId: string;
    title: string;
    description: string;
    durationDays: number;
    lastSeenLocation: string | null;
    policyVersion: string;
  }): Promise<string> {
    const { data: id, error } = await this.client.rpc("publish_community_wanted", {
      target_campus_id: input.campusId,
      target_description: input.description,
      target_duration_days: input.durationDays,
      target_kind: input.kind,
      target_last_seen_location: input.lastSeenLocation,
      target_policy_version: input.policyVersion,
      target_title: input.title,
    });
    if (error) throw error;
    const row = await this.client.from("wanted_requests").select("public_id").eq("id", id).single();
    if (row.error) throw row.error;
    return row.data.public_id;
  }

  async publishFree(input: {
    draftId: string;
    tokenHash: string;
    criteriaHash: string;
    policyVersion: string;
  }): Promise<{ outcome: "published" | "required" | "expired"; publicId: string | null }> {
    const { data, error } = await this.client.rpc("publish_free_wanted", {
      target_criteria_hash_hex: input.criteriaHash,
      target_draft_id: input.draftId,
      target_policy_version: input.policyVersion,
      target_token_hash_hex: input.tokenHash,
    });
    if (error) throw error;
    const outcome = data === "published" || data === "expired" ? data : "required";
    if (outcome !== "published") return { outcome, publicId: null };
    const row = await this.client
      .from("wanted_requests")
      .select("public_id")
      .eq("id", input.draftId)
      .single();
    if (row.error) throw row.error;
    return { outcome, publicId: row.data.public_id };
  }

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
        .eq("region_open", true)
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
        academicSessionId: row.academic_session_id ?? "",
        campusId: row.campus_id,
        courseId: row.course_id ?? "",
        description: row.description,
        durationDays: row.requested_duration_days,
        facultyId: row.faculty_id ?? "",
        languageId: row.language_id ?? "",
        policyAccepted: true,
        programmeId: row.programme_id ?? "",
        resourceTypeId: row.resource_type_id ?? "",
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
      .eq("kind", "academic")
      .in("status", ["open", "reviewing"])
      .neq("id", draft.id)
      .limit(50);
    if (wanted.error) throw wanted.error;
    if (wanted.data.length === 0) return [];

    const [courses, campuses, resourceTypes, sessions] = await Promise.all([
      this.client
        .from("courses")
        .select("id, code, name")
        .in("id", present(wanted.data.map(({ course_id }) => course_id))),
      this.client
        .from("campuses")
        .select("id, name")
        .in("id", present(wanted.data.map(({ campus_id }) => campus_id))),
      this.client
        .from("resource_types")
        .select("id, name")
        .in("id", present(wanted.data.map(({ resource_type_id }) => resource_type_id))),
      this.client
        .from("academic_sessions")
        .select("id, name")
        .in("id", present(wanted.data.map(({ academic_session_id }) => academic_session_id))),
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
      if (!row.course_id || !row.resource_type_id || !row.academic_session_id) return [];
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
            kind: "academic" as const,
            isFree: false,
            lastSeenLocation: null,
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
