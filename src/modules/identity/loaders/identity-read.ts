import type { AccountViewModel, InstitutionOption } from "@/contracts/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { SupabaseIdentityReadRepository } from "../repositories/supabase-identity-read-repository";
import { toAccountViewModel } from "../services/account-view-service";

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
