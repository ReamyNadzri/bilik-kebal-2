import { failure } from "@/contracts/operation-result";
import type {
  DecideTaxonomyRequestResult,
  ListTaxonomyRequestsResult,
  SubmitTaxonomyRequestResult,
} from "@/contracts/taxonomy-requests";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseTaxonomyRequestRepository } from "../repositories/supabase-taxonomy-request-repository";
import { TaxonomyRequestService } from "../services/taxonomy-request-service";

async function context() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const actor = user ? { userId: user.id } : null;
  // Names are filled in with the admin client only for rows RLS already
  // returned to this caller.
  const readClient = actor ? createSupabaseAdminClient() : client;
  return {
    actor,
    service: new TaxonomyRequestService(new SupabaseTaxonomyRequestRepository(client, readClient)),
  };
}

const unavailable = () =>
  failure("TAXONOMY_REQUESTS_UNAVAILABLE" as const, "Entry requests are unavailable. Try again.");

export async function submitTaxonomyRequest(input: unknown): Promise<SubmitTaxonomyRequestResult> {
  try {
    const loaded = await context();
    return loaded.service.submit(loaded.actor, input);
  } catch {
    return unavailable();
  }
}

export async function listOwnTaxonomyRequests(): Promise<ListTaxonomyRequestsResult> {
  try {
    const loaded = await context();
    return loaded.service.listOwn(loaded.actor);
  } catch {
    return unavailable();
  }
}

export async function listTaxonomyRequestQueue(): Promise<ListTaxonomyRequestsResult> {
  try {
    const loaded = await context();
    return loaded.service.listQueue(loaded.actor);
  } catch {
    return unavailable();
  }
}

export async function decideTaxonomyRequest(
  requestId: string,
  input: unknown,
): Promise<DecideTaxonomyRequestResult> {
  try {
    const loaded = await context();
    return loaded.service.decide(loaded.actor, requestId, input);
  } catch {
    return unavailable();
  }
}
