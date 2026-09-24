import type {
  CampusRegion,
  DecideCommunityPayoutResult,
  ListCommunityPayoutRequestsResult,
  ReadFreeAllowanceResult,
  RequestCommunityPayoutResult,
  CreateWantedDraftResult,
  ListCampusRegionsResult,
  ListWantedRepliesResult,
  PostWantedReplyResult,
  PrepareWantedPublicationResult,
  PublishCommunityWantedResult,
  PublishFreeWantedResult,
  ResolveWantedResult,
  Sen,
  SuggestWantedDuplicatesResult,
  UpdateWantedDraftResult,
  WantedSummary,
} from "@/contracts/marketplace";
import type { ListWantedQuery, ListWantedResult, ReadWantedResult } from "@/contracts/marketplace";
import { failure, success } from "@/contracts/operation-result";
import { getMarketplaceTokenSecret, parseServerEnv } from "@/lib/config/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SupabaseIdentityReadRepository } from "@/modules/identity/repositories/supabase-identity-read-repository";
import type { WantedActor } from "../domain/wanted-policy";
import { SupabaseWantedRepository } from "../repositories/supabase-wanted-repository";
import { WantedCommunityService } from "../services/wanted-community-service";
import { WantedDraftService } from "../services/wanted-draft-service";
import { WantedPublicationService } from "../services/wanted-publication-service";
import { WantedReadService } from "../services/wanted-read-service";

async function context(): Promise<{
  actor: WantedActor | null;
  draftService: WantedDraftService;
  publicationService: WantedPublicationService;
  communityService: WantedCommunityService;
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
    freePublisher: repository,
  });
  const communityService = new WantedCommunityService(repository, {
    paymentAvailability: env.PAYMENT_MODE === "disabled" ? "disabled" : "unavailable",
  });
  if (error || !user) return { actor: null, draftService, publicationService, communityService };
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
    communityService,
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
  const readClient = actor ? createSupabaseAdminClient() : client;
  return { actor, service: new WantedReadService(new SupabaseWantedRepository(readClient)) };
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

export async function publishFreeWanted(
  draftId: string,
  input: unknown,
): Promise<PublishFreeWantedResult> {
  try {
    const loaded = await context();
    const trustedInput =
      typeof input === "object" && input !== null && !Array.isArray(input)
        ? { ...input, draftId }
        : input;
    return loaded.publicationService.publishFree(loaded.actor, trustedInput);
  } catch {
    return unavailable();
  }
}

export async function publishCommunityWanted(
  input: unknown,
): Promise<PublishCommunityWantedResult> {
  try {
    const loaded = await context();
    return loaded.communityService.publish(loaded.actor, input);
  } catch {
    return unavailable();
  }
}

export async function postWantedReply(
  publicId: string,
  input: unknown,
): Promise<PostWantedReplyResult> {
  try {
    const loaded = await context();
    return loaded.communityService.reply(loaded.actor, publicId, input);
  } catch {
    return unavailable();
  }
}

export async function resolveCommunityWanted(publicId: string): Promise<ResolveWantedResult> {
  try {
    const loaded = await context();
    return loaded.communityService.resolve(loaded.actor, publicId);
  } catch {
    return unavailable();
  }
}

/** Replies are read with the server client after the viewer's email check. */
export async function listWantedReplies(publicId: string): Promise<ListWantedRepliesResult> {
  try {
    const client = await createSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    const actor = user
      ? {
          emailVerified: Boolean(user.email_confirmed_at),
          institutionId: null,
          institutionVerified: false,
          restricted: false,
          userId: user.id,
        }
      : null;
    const repository = new SupabaseWantedRepository(
      actor?.emailVerified ? createSupabaseAdminClient() : client,
    );
    return new WantedCommunityService(repository).listReplies(actor, publicId);
  } catch {
    return unavailable();
  }
}

/**
 * Every campus with its region state. Campus names and open/locked state are
 * public; open-request counts and totals are shown only to a verified email,
 * the same bar as browsing the Board.
 */
export async function listCampusRegions(): Promise<ListCampusRegionsResult> {
  try {
    const loaded = await readContext();
    const regions = await new SupabaseWantedRepository(
      createSupabaseAdminClient(),
    ).listCampusRegions();
    const canSeeCounts = loaded.actor?.emailVerified === true;
    return success(
      regions.map((region): CampusRegion =>
        canSeeCounts ? region : { ...region, openWantedCount: 0, openBountySen: 0 as Sen },
      ),
    );
  } catch {
    return failure("MARKETPLACE_UNAVAILABLE", "The campus map is temporarily unavailable.");
  }
}

/** The Archive: fulfilled and resolved Wanteds, for a verified email. */
export async function listArchivedWanted(): Promise<
  | { ok: true; data: WantedSummary[] }
  | { ok: false; code: "AUTH_REQUIRED" | "EMAIL_NOT_VERIFIED" | "MARKETPLACE_UNAVAILABLE" }
> {
  try {
    const loaded = await readContext();
    if (!loaded.actor) return { ok: false, code: "AUTH_REQUIRED" };
    if (!loaded.actor.emailVerified) return { ok: false, code: "EMAIL_NOT_VERIFIED" };
    return {
      ok: true,
      data: await new SupabaseWantedRepository(createSupabaseAdminClient()).listArchivedWanted(),
    };
  } catch {
    return { ok: false, code: "MARKETPLACE_UNAVAILABLE" };
  }
}

export interface LibraryItem {
  wanted: WantedSummary;
  claimId: string;
  grantedAt: string;
  revoked: boolean;
}

/**
 * The viewer's library: every resource they are entitled to (as a Backer, or
 * as the poster of a free request). Entitlements are read with the viewer's
 * own session, so row-level security limits them to the viewer's rows.
 */
export async function listOwnLibrary(): Promise<
  | { ok: true; data: LibraryItem[] }
  | { ok: false; code: "AUTH_REQUIRED" | "MARKETPLACE_UNAVAILABLE" }
> {
  try {
    const client = await createSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { ok: false, code: "AUTH_REQUIRED" };
    const entitlements = await client
      .from("entitlements")
      .select("wanted_request_id, claim_id, granted_at, is_revoked")
      .eq("user_id", user.id)
      .order("granted_at", { ascending: false });
    if (entitlements.error) throw entitlements.error;
    const rows = entitlements.data ?? [];
    const summaries = await new SupabaseWantedRepository(
      createSupabaseAdminClient(),
    ).listWantedByIds(rows.map((row) => row.wanted_request_id));
    // Summaries carry public ids; map internal ids through the rows' order.
    const admin = createSupabaseAdminClient();
    const ids = await admin
      .from("wanted_requests")
      .select("id, public_id")
      .in(
        "id",
        rows.map((row) => row.wanted_request_id),
      );
    if (ids.error) throw ids.error;
    const publicIdOf = new Map((ids.data ?? []).map((row) => [row.id, row.public_id]));
    const summaryOf = new Map(summaries.map((summary) => [summary.id, summary]));
    return {
      ok: true,
      data: rows.flatMap((row) => {
        const summary = summaryOf.get(publicIdOf.get(row.wanted_request_id) ?? "");
        return summary
          ? [
              {
                wanted: summary,
                claimId: row.claim_id,
                grantedAt: row.granted_at,
                revoked: row.is_revoked,
              },
            ]
          : [];
      }),
    };
  } catch {
    return { ok: false, code: "MARKETPLACE_UNAVAILABLE" };
  }
}

/** The signed-in member's free requests: 3 for life, plus reward-code credits. */
export async function readFreeAllowance(): Promise<ReadFreeAllowanceResult> {
  try {
    const loaded = await context();
    return loaded.communityService.freeAllowance(loaded.actor);
  } catch {
    return unavailable();
  }
}

export async function requestCommunityPayout(
  publicId: string,
  input: unknown,
): Promise<RequestCommunityPayoutResult> {
  try {
    const loaded = await context();
    return loaded.communityService.requestPayout(loaded.actor, publicId, input);
  } catch {
    return unavailable();
  }
}

/**
 * The Sheriff queue of bounty releases. RLS on the caller's own client decides
 * which releases they may review; the admin client only fills in names.
 */
export async function listPendingCommunityPayouts(): Promise<ListCommunityPayoutRequestsResult> {
  try {
    const client = await createSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return failure("AUTH_REQUIRED", "");
    const service = new WantedCommunityService(
      new SupabaseWantedRepository(client, createSupabaseAdminClient()),
    );
    return service.listPendingPayouts({
      emailVerified: Boolean(user.email_confirmed_at),
      institutionId: null,
      institutionVerified: false,
      restricted: false,
      userId: user.id,
    });
  } catch {
    return unavailable();
  }
}

export async function decideCommunityPayout(
  requestId: string,
  input: unknown,
): Promise<DecideCommunityPayoutResult> {
  try {
    const loaded = await context();
    return loaded.communityService.decidePayout(loaded.actor, requestId, input);
  } catch {
    return unavailable();
  }
}
