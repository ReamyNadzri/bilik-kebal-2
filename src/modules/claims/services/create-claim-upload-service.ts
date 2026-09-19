import { randomUUID } from "node:crypto";

import { parseServerEnv } from "@/lib/config/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { SupabaseClaimUploadGateway } from "../gateways/supabase-claim-upload-gateway";
import { SupabaseClaimsRepository } from "../repositories/supabase-claims-repository";
import { ClaimUploadService } from "./claim-upload-service";

export type ClaimUploadContext = {
  userId: string;
  getActor: (wantedId: string) => Promise<{
    actor: {
      userId: string;
      institutionId: string;
      emailVerified: boolean;
      institutionVerified: boolean;
      restricted: boolean;
    } | null;
    wantedStatus: "open" | "reviewing" | "expired" | "missing";
  }>;
  service: ClaimUploadService;
};

export async function createClaimUploadContext(): Promise<ClaimUploadContext | null> {
  const client = await createSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;

  return {
    userId: auth.user.id,
    service: new ClaimUploadService({
      generateId: randomUUID,
      gateway: new SupabaseClaimUploadGateway(client),
      now: () => new Date(),
      repository: new SupabaseClaimsRepository(client),
      uploadsEnabled: parseServerEnv(process.env).PUBLIC_UPLOADS_ENABLED,
    }),
    async getActor(wantedId) {
      const [wanted, membership, restriction] = await Promise.all([
        client.from("wanted_requests").select("status").eq("id", wantedId).maybeSingle(),
        client
          .from("institution_memberships")
          .select("institution_id, verification_state")
          .eq("user_id", auth.user.id)
          .eq("verification_state", "verified")
          .maybeSingle(),
        client
          .from("account_restrictions")
          .select("id")
          .eq("user_id", auth.user.id)
          .is("lifted_at", null)
          .maybeSingle(),
      ]);
      const wantedStatus =
        wanted.data?.status === "open" || wanted.data?.status === "reviewing"
          ? wanted.data.status
          : wanted.data?.status === "expired"
            ? "expired"
            : "missing";
      const actor = membership.data
        ? {
            userId: auth.user.id,
            institutionId: membership.data.institution_id,
            emailVerified: Boolean(auth.user.email_confirmed_at),
            institutionVerified: true,
            restricted: Boolean(restriction.data),
          }
        : null;
      return { actor, wantedStatus };
    },
  };
}
