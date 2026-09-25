import { resolveAvatarUrl } from "@/lib/avatars";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AccountViewModel,
  InstitutionOption,
  VerificationQueueItem,
} from "@/contracts/identity";
import type { Database } from "@/lib/supabase/database.types";

import type { AccountRecord } from "../services/account-view-service";
import type {
  EvidenceAuthorisation,
  EvidenceReadRepository,
} from "../services/review-read-service";

export class IdentityReadError extends Error {
  constructor() {
    super("Identity read failed");
    this.name = "IdentityReadError";
  }
}

export class SupabaseIdentityReadRepository implements EvidenceReadRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async readAccount(user: User): Promise<AccountRecord | null> {
    const [profile, membership, restriction, latestRequest, platformRoles, institutionRoles] =
      await Promise.all([
        this.client
          .from("profiles")
          .select("display_name, public_id, avatar_object_key, avatar_preset, created_at")
          .eq("user_id", user.id)
          .maybeSingle(),
        this.client
          .from("institution_memberships")
          .select("institution_id, verification_state")
          .eq("user_id", user.id)
          .maybeSingle(),
        this.client
          .from("account_restrictions")
          .select("id, expires_at")
          .eq("user_id", user.id)
          .is("lifted_at", null)
          .limit(1)
          .maybeSingle(),
        this.client
          .from("institution_verification_requests")
          .select("id, state, created_at, reviewed_at, decision_reason_code, evidence_delete_after")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        this.client.from("platform_role_assignments").select("role").eq("user_id", user.id),
        this.client
          .from("institution_role_assignments")
          .select("institution_id")
          .eq("user_id", user.id)
          .eq("role", "institution_sheriff")
          .limit(1),
      ]);

    if (
      profile.error ||
      membership.error ||
      restriction.error ||
      latestRequest.error ||
      platformRoles.error ||
      institutionRoles.error
    ) {
      throw new IdentityReadError();
    }

    if (!profile.data) {
      return null;
    }

    let institution: AccountRecord["institution"] = null;
    if (membership.data) {
      const institutionResult = await this.client
        .from("institutions")
        .select("id, name")
        .eq("id", membership.data.institution_id)
        .maybeSingle();
      if (institutionResult.error) {
        throw new IdentityReadError();
      }
      institution = institutionResult.data;
    }

    const request = latestRequest.data;
    const latestVerificationRequest: AccountViewModel["latestVerificationRequest"] = request
      ? {
          decidedAt: request.reviewed_at,
          evidenceDeleteAfter: request.evidence_delete_after,
          reasonCode: request.decision_reason_code,
          requestId: request.id,
          state: request.state,
          submittedAt: request.created_at,
        }
      : null;

    const requestState = request?.state;
    const institutionVerificationState =
      membership.data?.verification_state ??
      (requestState === "pending" || requestState === "rejected" ? requestState : "unverified");

    return {
      displayName: profile.data.display_name,
      publicId: profile.data.public_id,
      avatarUrl: resolveAvatarUrl(
        this.client,
        profile.data.avatar_object_key,
        profile.data.avatar_preset,
      ),
      avatarPreset: profile.data.avatar_preset,
      email: user.email ?? null,
      joinedAt: profile.data.created_at,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      hasActiveRestriction: Boolean(restriction.data),
      restrictionExpiresAt: restriction.data?.expires_at ?? null,
      hasConsoleAccess: platformRoles.data.length > 0 || institutionRoles.data.length > 0,
      institution,
      institutionVerificationState,
      latestVerificationRequest,
    };
  }

  async listActiveInstitutions(): Promise<InstitutionOption[]> {
    const result = await this.client
      .from("institutions")
      .select("id, name, slug")
      .eq("active", true)
      .order("name", { ascending: true });

    if (result.error) {
      throw new IdentityReadError();
    }

    return result.data;
  }

  async listPendingVerificationRequests(): Promise<VerificationQueueItem[]> {
    const requests = await this.client
      .from("institution_verification_requests")
      .select("id, user_id, institution_id, state, created_at, evidence_delete_after")
      .eq("state", "pending")
      .order("created_at", { ascending: true })
      .limit(100);

    if (requests.error) {
      throw new IdentityReadError();
    }

    const userIds = [...new Set(requests.data.map(({ user_id }) => user_id))];
    const institutionIds = [...new Set(requests.data.map(({ institution_id }) => institution_id))];
    const [profiles, institutions] = await Promise.all([
      userIds.length
        ? this.client.from("profiles").select("user_id, display_name").in("user_id", userIds)
        : Promise.resolve({ data: [], error: null }),
      institutionIds.length
        ? this.client.from("institutions").select("id, name").in("id", institutionIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profiles.error || institutions.error) {
      throw new IdentityReadError();
    }

    const namesByUser = new Map(profiles.data.map((row) => [row.user_id, row.display_name]));
    const namesByInstitution = new Map(institutions.data.map((row) => [row.id, row.name]));

    return requests.data.map((request) => ({
      applicantDisplayName: namesByUser.get(request.user_id) ?? "Unknown applicant",
      evidenceDeleteAfter: request.evidence_delete_after,
      institutionId: request.institution_id,
      institutionName: namesByInstitution.get(request.institution_id) ?? "Unknown institution",
      requestId: request.id,
      state: request.state,
      submittedAt: request.created_at,
    }));
  }

  async authoriseEvidenceRead(input: {
    actorUserId: string;
    requestId: string;
  }): Promise<EvidenceAuthorisation> {
    void input.actorUserId;
    const result = await this.client.rpc("authorise_identity_evidence_read", {
      target_request_id: input.requestId,
    });

    if (!result.error && result.data) {
      return { objectPath: result.data, status: "authorised" };
    }

    const message = result.error?.message ?? "";
    if (message.includes("EVIDENCE_EXPIRED")) return { status: "expired" };
    if (message.includes("NOT_AUTHORIZED")) return { status: "not_authorized" };
    if (message.includes("RECENT_AUTH_REQUIRED")) return { status: "recent_auth_required" };
    if (message.includes("REQUEST_NOT_FOUND")) return { status: "not_found" };
    throw new IdentityReadError();
  }
}
