import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { EntitlementRecord } from "@/contracts/entitlements";
import type { ClaimDownloadMeta, EntitlementRepository } from "./entitlement-repository";

export class SupabaseEntitlementRepository implements EntitlementRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getClaimDownloadMeta(claimId: string): Promise<ClaimDownloadMeta | null> {
    const { data, error } = await this.client
      .from("claims")
      .select(
        "id, wanted_request_id, hunter_user_id, institution_id, is_restricted, free_release_opt_in, rights_confirmed_at, status, bucket, object_key, file_name, size_bytes, mime_type",
      )
      .eq("id", claimId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      wantedRequestId: data.wanted_request_id,
      hunterUserId: data.hunter_user_id,
      institutionId: data.institution_id,
      isRestricted: data.is_restricted,
      freeReleaseOptIn: data.free_release_opt_in,
      rightsConfirmedAt: data.rights_confirmed_at,
      status: data.status,
      bucket: data.bucket,
      objectKey: data.object_key,
      fileName: data.file_name,
      sizeBytes: data.size_bytes,
      mimeType: data.mime_type,
    };
  }

  async getEntitlement(userId: string, wantedRequestId: string): Promise<EntitlementRecord | null> {
    const { data, error } = await this.client
      .from("entitlements")
      .select(
        "id, wanted_request_id, claim_id, user_id, granted_at, is_revoked, revoked_at, revocation_reason",
      )
      .eq("user_id", userId)
      .eq("wanted_request_id", wantedRequestId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      wantedRequestId: data.wanted_request_id,
      claimId: data.claim_id,
      userId: data.user_id,
      grantedAt: data.granted_at,
      isRevoked: data.is_revoked,
      revokedAt: data.revoked_at,
      revocationReason: data.revocation_reason,
    };
  }

  async isStaff(userId: string, institutionId?: string): Promise<boolean> {
    const { data: platformData } = await this.client
      .from("platform_role_assignments")
      .select("role")
      .eq("user_id", userId);

    const hasPlatformRole = (platformData ?? []).some(
      (r) => r.role === "owner" || r.role === "platform_sheriff",
    );
    if (hasPlatformRole) return true;

    if (institutionId) {
      const { data: instData } = await this.client
        .from("institution_role_assignments")
        .select("role")
        .eq("user_id", userId)
        .eq("institution_id", institutionId);

      const hasInstSheriff = (instData ?? []).some((r) => r.role === "institution_sheriff");
      if (hasInstSheriff) return true;
    }

    return false;
  }

  async createSignedDownloadUrl(
    bucket: string,
    objectKey: string,
    fileName: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(objectKey, expiresInSeconds, {
        download: fileName,
      });

    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? "Failed to create signed download URL");
    }

    return data.signedUrl;
  }

  async revokeEntitlementsForWanted(wantedRequestId: string, reason: string): Promise<number> {
    const rpcClient = this.client as unknown as {
      rpc: (
        name: string,
        args?: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data, error } = await rpcClient.rpc("revoke_entitlements_for_wanted", {
      target_wanted_id: wantedRequestId,
      target_reason: reason,
    });

    if (error) {
      throw new Error(error.message);
    }

    return (data as number) ?? 0;
  }
}
