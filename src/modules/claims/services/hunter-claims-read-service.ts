import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClaimStatus, ClaimSummary } from "@/features/marketplace/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Maps PostgreSQL claim_status enum values to presentation ClaimStatus strings.
 */
export function toPresentationClaimStatus(status: string): ClaimStatus {
  switch (status) {
    case "uploading":
      return "quarantined";
    case "screening":
      return "screening";
    case "needs_information":
      return "needs-information";
    case "under_review":
      return "under-review";
    case "approved":
      return "approved";
    case "not_selected":
      return "not-selected";
    case "rejected":
    case "withdrawn":
      return "rejected";
    default:
      return "quarantined";
  }
}

interface ClaimJoinRow {
  readonly id: string;
  readonly public_id: string;
  readonly status: string;
  readonly created_at: string;
  readonly wanted_requests: {
    readonly public_id: string;
    readonly title: string;
    readonly courses: {
      readonly code: string;
      readonly name: string;
    } | null;
  } | null;
}

/**
 * Service for reading an authenticated Hunter's submitted claims and mapping
 * them to presentation models for the Hunter's Office workspace (/claims).
 */
export class HunterClaimsReadService {
  constructor(private readonly client: SupabaseClient) {}

  async listHunterClaims(userId: string): Promise<ClaimSummary[]> {
    if (!userId || userId.trim() === "") {
      return [];
    }

    try {
      const { data, error } = await this.client
        .from("claims")
        .select(
          `
          id,
          public_id,
          status,
          created_at,
          wanted_requests (
            public_id,
            title,
            courses (
              code,
              name
            )
          )
        `,
        )
        .eq("hunter_user_id", userId)
        .order("created_at", { ascending: false });

      if (error || !data) {
        return [];
      }

      const rows = data as unknown as readonly ClaimJoinRow[];

      return rows.map((row) => ({
        id: row.public_id ?? row.id,
        wantedId: row.wanted_requests?.public_id ?? "",
        wantedTitle: row.wanted_requests?.title ?? "Untitled Wanted",
        courseCode: row.wanted_requests?.courses?.code ?? "",
        courseName: row.wanted_requests?.courses?.name ?? "",
        status: toPresentationClaimStatus(row.status),
        submittedAt: row.created_at,
      }));
    } catch {
      return [];
    }
  }
}

export async function createHunterClaimsReadService(): Promise<HunterClaimsReadService> {
  const client = await createSupabaseServerClient();
  return new HunterClaimsReadService(client);
}
