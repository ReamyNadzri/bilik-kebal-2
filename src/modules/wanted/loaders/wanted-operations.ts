import type { CreateWantedDraftResult, UpdateWantedDraftResult } from "@/contracts/marketplace";
import { failure } from "@/contracts/operation-result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseIdentityReadRepository } from "@/modules/identity/repositories/supabase-identity-read-repository";
import type { WantedActor } from "../domain/wanted-policy";
import { SupabaseWantedRepository } from "../repositories/supabase-wanted-repository";
import { WantedDraftService } from "../services/wanted-draft-service";

async function context(): Promise<{ actor: WantedActor | null; service: WantedDraftService }> {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  const service = new WantedDraftService(new SupabaseWantedRepository(client));
  if (error || !user) return { actor: null, service };
  const account = await new SupabaseIdentityReadRepository(client).readAccount(user);
  return {
    actor: account
      ? {
          emailVerified: Boolean(user.email_confirmed_at),
          institutionId: account.institution?.id ?? null,
          institutionVerified: account.institutionVerificationState === "verified",
          restricted: account.hasActiveRestriction,
          userId: user.id,
        }
      : {
          emailVerified: Boolean(user.email_confirmed_at),
          institutionId: null,
          institutionVerified: false,
          restricted: false,
          userId: user.id,
        },
    service,
  };
}

const unavailable = () =>
  failure(
    "MARKETPLACE_UNAVAILABLE" as const,
    "The Wanted workspace is temporarily unavailable. Try again.",
  );

export async function createWantedDraft(input: unknown): Promise<CreateWantedDraftResult> {
  try {
    const loaded = await context();
    return loaded.service.create(loaded.actor, input);
  } catch {
    return unavailable();
  }
}

export async function updateWantedDraft(
  draftId: string,
  input: unknown,
): Promise<UpdateWantedDraftResult> {
  try {
    const loaded = await context();
    return loaded.service.update(loaded.actor, draftId, input);
  } catch {
    return unavailable();
  }
}
