import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaxonomyRequestCategory, TaxonomyRequestView } from "@/contracts/taxonomy-requests";
import type { Database } from "@/lib/supabase/database.types";
import type { TaxonomyRequestRepository } from "../services/taxonomy-request-service";

type Client = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["taxonomy_requests"]["Row"];

const COLUMNS =
  "id, requester_user_id, category, label, course_code, parent_faculty_id, parent_programme_id, note, status, decision_note, created_at, decided_at";

/**
 * `client` carries the caller's session: RLS decides which requests are
 * visible (their own, or those they may review). `readClient` only fills in
 * parent and requester names after that.
 */
export class SupabaseTaxonomyRequestRepository implements TaxonomyRequestRepository {
  constructor(
    private readonly client: Client,
    private readonly readClient: Client = client,
  ) {}

  async submit(input: {
    category: TaxonomyRequestCategory;
    label: string;
    courseCode: string | null;
    parentId: string | null;
    note: string | null;
  }): Promise<string> {
    const { data, error } = await this.client.rpc("submit_taxonomy_request", {
      target_category: input.category,
      target_course_code: input.courseCode,
      target_label: input.label,
      target_note: input.note,
      target_parent_id: input.parentId,
    });
    if (error) throw error;
    return data;
  }

  async listOwn(userId: string): Promise<TaxonomyRequestView[]> {
    const { data, error } = await this.client
      .from("taxonomy_requests")
      .select(COLUMNS)
      .eq("requester_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return this.present(data as Row[], false);
  }

  async listPendingForReview(viewerUserId: string): Promise<TaxonomyRequestView[]> {
    const { data, error } = await this.client
      .from("taxonomy_requests")
      .select(COLUMNS)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;
    // The viewer's own requests stay listed, flagged, so a Sheriff who asked
    // for an entry sees it waiting instead of thinking it was lost.
    const views = await this.present(data as Row[], true);
    const own = new Set(
      (data as Row[]).filter((row) => row.requester_user_id === viewerUserId).map((row) => row.id),
    );
    return views.map((view) => (own.has(view.id) ? { ...view, ownRequest: true } : view));
  }

  async decide(input: {
    requestId: string;
    approve: boolean;
    note: string | null;
    openRegion: boolean;
  }): Promise<void> {
    const { error } = await this.client.rpc("decide_taxonomy_request", {
      approve: input.approve,
      open_region: input.openRegion,
      target_note: input.note,
      target_request_id: input.requestId,
    });
    if (error) throw error;
  }

  private async present(rows: Row[], withRequester: boolean): Promise<TaxonomyRequestView[]> {
    if (rows.length === 0) return [];
    const facultyIds = rows.flatMap((row) =>
      row.parent_faculty_id ? [row.parent_faculty_id] : [],
    );
    const programmeIds = rows.flatMap((row) =>
      row.parent_programme_id ? [row.parent_programme_id] : [],
    );
    const [faculties, programmes, people] = await Promise.all([
      facultyIds.length
        ? this.readClient.from("faculties").select("id, name").in("id", facultyIds)
        : Promise.resolve({ data: [], error: null }),
      programmeIds.length
        ? this.readClient.from("programmes").select("id, name").in("id", programmeIds)
        : Promise.resolve({ data: [], error: null }),
      withRequester
        ? this.readClient
            .from("profiles")
            .select("user_id, display_name")
            .in(
              "user_id",
              rows.map((row) => row.requester_user_id),
            )
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (faculties.error || programmes.error || people.error) {
      throw faculties.error ?? programmes.error ?? people.error;
    }
    const names = new Map<string, string>([
      ...(faculties.data ?? []).map((row): [string, string] => [row.id, row.name]),
      ...(programmes.data ?? []).map((row): [string, string] => [row.id, row.name]),
    ]);
    const requesterNames = new Map(
      (people.data ?? []).map((row): [string, string] => [row.user_id, row.display_name]),
    );
    return rows.map((row) => {
      const parentId = row.parent_programme_id ?? row.parent_faculty_id;
      const view: TaxonomyRequestView = {
        id: row.id,
        category: row.category as TaxonomyRequestCategory,
        label: row.label,
        courseCode: row.course_code,
        parentName: parentId ? (names.get(parentId) ?? null) : null,
        note: row.note,
        state: row.status as TaxonomyRequestView["state"],
        decisionNote: row.decision_note,
        createdAt: row.created_at,
        decidedAt: row.decided_at,
      };
      return withRequester
        ? { ...view, requesterName: requesterNames.get(row.requester_user_id) ?? "VAULTIX member" }
        : view;
    });
  }
}
