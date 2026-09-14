import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AccountViewModel, InstitutionOption } from "@/contracts/identity";
import type { Database } from "@/lib/supabase/database.types";

import type { AccountRecord } from "../services/account-view-service";

export class IdentityReadError extends Error {
  constructor() {
    super("Identity read failed");
    this.name = "IdentityReadError";
  }
}

export class SupabaseIdentityReadRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async readAccount(user: User): Promise<AccountRecord | null> {
    const [profile, membership, restriction, latestRequest, platformRoles, institutionRoles] =
      await Promise.all([
        this.client.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
        this.client
          .from("institution_memberships")
          .select("institution_id, verification_state")
          .eq("user_id", user.id)
          .maybeSingle(),
        this.client
          .from("account_restrictions")
          .select("id")
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
      emailConfirmedAt: user.email_confirmed_at ?? null,
      hasActiveRestriction: Boolean(restriction.data),
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
}
