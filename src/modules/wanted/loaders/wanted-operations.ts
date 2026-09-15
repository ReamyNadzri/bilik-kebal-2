import type {
  CreateWantedDraftResult,
  PrepareWantedPublicationResult,
  SuggestWantedDuplicatesResult,
  UpdateWantedDraftResult,
} from "@/contracts/marketplace";
import type { ListWantedQuery, ListWantedResult, ReadWantedResult } from "@/contracts/marketplace";
import { failure } from "@/contracts/operation-result";
import { getMarketplaceTokenSecret, parseServerEnv } from "@/lib/config/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseIdentityReadRepository } from "@/modules/identity/repositories/supabase-identity-read-repository";
import type { WantedActor } from "../domain/wanted-policy";
import { SupabaseWantedRepository } from "../repositories/supabase-wanted-repository";
import { WantedDraftService } from "../services/wanted-draft-service";
import { WantedPublicationService } from "../services/wanted-publication-service";
import { WantedReadService } from "../services/wanted-read-service";

async function context(): Promise<{
  actor: WantedActor | null;
  draftService: WantedDraftService;
  publicationService: WantedPublicationService;
}> {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  const repository = new SupabaseWantedRepository(client);
  const draftService = new WantedDraftService(repository);
  const env = parseServerEnv(process.env);
  const publicationService = new WantedPublicationService(repository, {
    paymentAvailability: env.PAYMENT_MODE === "disabled" ? "disabled" : "unavailable",
    tokenSecret: getMarketplaceTokenSecret(process.env),
  });
  if (error || !user) return { actor: null, draftService, publicationService };
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
    draftService,
    publicationService,
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
    return loaded.draftService.create(loaded.actor, input);
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
    return loaded.draftService.update(loaded.actor, draftId, input);
  } catch {
    return unavailable();
  }
}

export async function suggestWantedDuplicates(
  input: unknown,
): Promise<SuggestWantedDuplicatesResult> {
  try {
    const loaded = await context();
    return loaded.publicationService.suggestDuplicates(loaded.actor, input);
  } catch {
    return unavailable();
  }
}

export async function prepareWantedPublication(
  draftId: string,
  input: unknown,
): Promise<PrepareWantedPublicationResult> {
  try {
    const loaded = await context();
    const trustedInput =
      typeof input === "object" && input !== null && !Array.isArray(input)
        ? { ...input, draftId }
        : input;
    return loaded.publicationService.preparePublication(loaded.actor, trustedInput);
  } catch {
    return unavailable();
  }
}

async function readContext() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const actor = user ? { emailVerified: Boolean(user.email_confirmed_at) } : null;
  return { actor, service: new WantedReadService(new SupabaseWantedRepository(client)) };
}

export async function listPublicWanted(query: ListWantedQuery): Promise<ListWantedResult> {
  try {
    const loaded = await readContext();
    return loaded.service.list(loaded.actor, query);
  } catch {
    return failure(
      "MARKETPLACE_UNAVAILABLE",
      "The Wanted Board is temporarily unavailable. Try again.",
    );
  }
}

export async function readPublicWanted(id: string): Promise<ReadWantedResult> {
  try {
    const loaded = await readContext();
    return loaded.service.read(loaded.actor, id);
  } catch {
    return failure(
      "MARKETPLACE_UNAVAILABLE",
      "The Wanted request is temporarily unavailable. Try again.",
    );
  }
}
