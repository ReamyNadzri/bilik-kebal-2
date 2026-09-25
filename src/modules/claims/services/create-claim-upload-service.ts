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
    /** The request's internal id, which the claim operations take. */
    internalWantedId: string | null;
  }>;
  service: ClaimUploadService;
};

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      // Screens address a Wanted by its public id (the one in /wanted/<id>);
      // the claim operation takes the internal id. Looking it up by the
      // internal id alone never found the request, so every claim failed.
      const shaped = UUID_SHAPE.test(wantedId);
      const [wanted, membership, restriction] = await Promise.all([
        shaped
          ? client
              .from("wanted_requests")
              .select("id, status")
              .or(`public_id.eq.${wantedId},id.eq.${wantedId}`)
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
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
      return { actor, wantedStatus, internalWantedId: wanted.data?.id ?? null };
    },
  };
}
