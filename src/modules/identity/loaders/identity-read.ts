import type { User } from "@supabase/supabase-js";
import { cache } from "react";

import type {
  AccountViewModel,
  InstitutionOption,
  VerificationQueueItem,
} from "@/contracts/identity";
import { getRequestSupabaseClient, getRequestUser } from "@/lib/supabase/server";

import { SupabaseEvidenceReadSigner } from "../gateways/supabase-evidence-read-signer";
import { SupabaseIdentityReadRepository } from "../repositories/supabase-identity-read-repository";
import { toAccountViewModel, type AccountRecord } from "../services/account-view-service";
import { EvidenceReadService, canLoadReviewQueue } from "../services/review-read-service";
import type { PlatformRole, VerificationActor } from "../services/verification-service";

/** The signed-in user and their account record; the record is null without a profile. */
export interface AccountContext {
  readonly user: User;
  readonly record: AccountRecord | null;
}

/**
 * The signed-in user and their account record, read once per server render.
 *
 * The root layout, the page's guard and every loader that needs the actor used
 * to repeat this read, relying on Next to collapse the identical requests.
 * Sharing it makes one Auth check and one set of identity queries per render
 * explicit. `cache` scopes the answer to one request, so no viewer ever sees
 * another's; route handlers, where `cache` does not memoise, read it fresh.
 *
 * Null when nobody is signed in. Throws when identity is unreachable, and every
 * caller in the same render sees the same failure.
 */
export const loadAccountContext = cache(async (): Promise<AccountContext | null> => {
  const {
    data: { user },
    error,
  } = await getRequestUser();

  if (error || !user) {
    return null;
  }

  const client = await getRequestSupabaseClient();
  const record = await new SupabaseIdentityReadRepository(client).readAccount(user);
  return { record, user };
});

export async function loadAccountViewModel(): Promise<AccountViewModel | null> {
  const context = await loadAccountContext();
  return context?.record ? toAccountViewModel(context.record) : null;
}

export type SelectableInstitutionsLoadResult =
  | { status: "auth_required" }
  | { status: "email_not_verified" }
  | { status: "ready"; institutions: InstitutionOption[] };

export async function loadSelectableInstitutions(): Promise<SelectableInstitutionsLoadResult> {
  const client = await getRequestSupabaseClient();
  const {
    data: { user },
    error,
  } = await getRequestUser();

  if (error || !user) {
    return { status: "auth_required" };
  }

  if (!user.email_confirmed_at) {
    return { status: "email_not_verified" };
  }

  return {
    institutions: await new SupabaseIdentityReadRepository(client).listActiveInstitutions(),
    status: "ready",
  };
}

export type ReviewQueueLoadResult =
  | { status: "auth_required" | "not_authorized" }
  | { status: "ready"; items: VerificationQueueItem[] };

async function loadReviewContext() {
  const client = await getRequestSupabaseClient();
  const {
    data: { user },
    error,
  } = await getRequestUser();
  if (error || !user) return null;

  const [platformRoles, institutionRoles] = await Promise.all([
    client.from("platform_role_assignments").select("role").eq("user_id", user.id),
    client
      .from("institution_role_assignments")
      .select("institution_id")
      .eq("user_id", user.id)
      .eq("role", "institution_sheriff"),
  ]);
  if (platformRoles.error || institutionRoles.error) {
    throw new Error("Identity role lookup failed");
  }

  const roles = platformRoles.data.map(({ role }) => role);
  const platformRole: PlatformRole | null = roles.includes("owner")
    ? "owner"
    : roles.includes("platform_sheriff")
      ? "platform_sheriff"
      : null;
  const actor: VerificationActor = {
    authenticatedAt: user.last_sign_in_at ?? user.created_at,
    institutionSheriffFor: institutionRoles.data.map(({ institution_id }) => institution_id),
    platformRole,
    userId: user.id,
  };
  return { actor, client };
}

export async function loadVerificationReviewQueue(): Promise<ReviewQueueLoadResult> {
  const context = await loadReviewContext();
  if (!context) return { status: "auth_required" };
  if (!canLoadReviewQueue(context.actor)) return { status: "not_authorized" };
  return {
    items: await new SupabaseIdentityReadRepository(
      context.client,
    ).listPendingVerificationRequests(),
    status: "ready",
  };
}

export async function createEvidenceReadContext() {
  const context = await loadReviewContext();
  if (!context) return null;
  return {
    actor: context.actor,
    service: new EvidenceReadService(
      new SupabaseIdentityReadRepository(context.client),
      new SupabaseEvidenceReadSigner(context.client),
      () => new Date(),
    ),
  };
}
