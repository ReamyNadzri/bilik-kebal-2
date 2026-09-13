import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import type { VerificationRepository } from "../services/verification-service";

export class IdentityPersistenceError extends Error {
  constructor() {
    super("Identity persistence operation failed");
    this.name = "IdentityPersistenceError";
  }
}

export class SupabaseVerificationRepository implements VerificationRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async verifyMembershipByEmailDomain(
    domain: string,
  ): Promise<{ institutionId: string; status: "verified" } | { status: "not_approved" }> {
    void domain;
    const { data, error } = await this.client.rpc("verify_own_institution_by_domain");

    if (error?.message.includes("EMAIL_DOMAIN_NOT_APPROVED")) {
      return { status: "not_approved" };
    }

    if (error || !data) {
      throw new IdentityPersistenceError();
    }

    return { institutionId: data, status: "verified" };
  }

  async createManualRequest(input: {
    evidenceDeleteAfter: string;
    evidenceObjectPath: string;
    institutionId: string;
    userId: string;
  }): Promise<{ requestId: string }> {
    const { data, error } = await this.client
      .from("institution_verification_requests")
      .insert({
        evidence_delete_after: input.evidenceDeleteAfter,
        evidence_object_path: input.evidenceObjectPath,
        institution_id: input.institutionId,
        user_id: input.userId,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new IdentityPersistenceError();
    }

    return { requestId: data.id };
  }

  async reviewManualRequest(input: {
    actorUserId: string;
    decision: "approved" | "rejected";
    institutionId: string;
    reasonCode: string;
    requestId: string;
    reviewedAt: string;
  }): Promise<{ status: "conflict" | "not_found" | "updated" }> {
    const { data, error } = await this.client.rpc("review_institution_verification_request", {
      decision: input.decision,
      reason_code: input.reasonCode,
      target_request_id: input.requestId,
    });

    if (error || (data !== "updated" && data !== "not_found" && data !== "conflict")) {
      throw new IdentityPersistenceError();
    }

    return { status: data };
  }

  async restrictAccount(input: {
    actorUserId: string;
    reasonCode: string;
    userId: string;
  }): Promise<{ status: "already_active" | "created" }> {
    const { data, error } = await this.client.rpc("restrict_account", {
      reason_code: input.reasonCode,
      target_user_id: input.userId,
    });

    if (error || !data) {
      throw new IdentityPersistenceError();
    }

    return { status: "created" };
  }
}
