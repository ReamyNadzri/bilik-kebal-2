import type {
  AccountViewModel,
  InstitutionOption,
  VerificationQueueItem,
} from "@/contracts/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { SupabaseEvidenceReadSigner } from "../gateways/supabase-evidence-read-signer";
import { SupabaseIdentityReadRepository } from "../repositories/supabase-identity-read-repository";
import { toAccountViewModel } from "../services/account-view-service";
import { EvidenceReadService, canLoadReviewQueue } from "../services/review-read-service";
import type { PlatformRole, VerificationActor } from "../services/verification-service";

export async function loadAccountViewModel(): Promise<AccountViewModel | null> {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return null;
  }

  const record = await new SupabaseIdentityReadRepository(client).readAccount(user);
  return record ? toAccountViewModel(record) : null;
}

export type SelectableInstitutionsLoadResult =
  | { status: "auth_required" }
  | { status: "email_not_verified" }
  | { status: "ready"; institutions: InstitutionOption[] };

export async function loadSelectableInstitutions(): Promise<SelectableInstitutionsLoadResult> {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

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
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
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
