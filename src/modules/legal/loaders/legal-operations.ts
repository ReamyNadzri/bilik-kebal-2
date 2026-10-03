import { failure } from "@/contracts/operation-result";
import type {
  AcceptTermsResult,
  AnswerPrivacyRequestResult,
  ListOwnPrivacyRequestsResult,
  ListPrivacyRequestsResult,
  PrivacyRequestStatus,
  SubmitPrivacyRequestResult,
} from "@/contracts/legal";
import { getRequestSupabaseClient, getRequestUser } from "@/lib/supabase/server";
import { SupabaseLegalRepository } from "../repositories/supabase-legal-repository";
import { LegalService } from "../services/legal-service";

/** The actor comes from the request's shared Auth check, not a check of its own. */
async function context() {
  const client = await getRequestSupabaseClient();
  const {
    data: { user },
  } = await getRequestUser();
  return {
    actor: user ? { userId: user.id } : null,
    service: new LegalService(new SupabaseLegalRepository(client)),
  };
}

type Loaded = Awaited<ReturnType<typeof context>>;

export async function acceptTerms(input: unknown): Promise<AcceptTermsResult> {
  try {
    const { actor, service } = await context();
    return await service.acceptTerms(actor, input);
  } catch {
    return failure("TERMS_UNAVAILABLE", "Your agreement could not be saved. Try again.");
  }
}

async function privacy<T>(operation: (loaded: Loaded) => Promise<T>) {
  try {
    return await operation(await context());
  } catch {
    return failure("PRIVACY_UNAVAILABLE" as const, "Privacy requests are unavailable. Try again.");
  }
}

export const submitPrivacyRequest = (input: unknown): Promise<SubmitPrivacyRequestResult> =>
  privacy(({ actor, service }) => service.submitPrivacyRequest(actor, input));

export const listOwnPrivacyRequests = (): Promise<ListOwnPrivacyRequestsResult> =>
  privacy(({ actor, service }) => service.listOwn(actor));

export const listPrivacyRequests = (
  status: PrivacyRequestStatus = "open",
): Promise<ListPrivacyRequestsResult> =>
  privacy(({ actor, service }) => service.listForOwner(actor, status));

export const answerPrivacyRequest = (
  requestId: string,
  input: unknown,
): Promise<AnswerPrivacyRequestResult> =>
  privacy(({ actor, service }) => service.answer(actor, requestId, input));
