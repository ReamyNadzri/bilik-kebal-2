import {
  listOwnTaxonomyRequests,
  submitTaxonomyRequest,
} from "@/modules/taxonomy-requests/loaders/taxonomy-request-operations";
import {
  readJson,
  taxonomyRequestResponse,
} from "@/modules/taxonomy-requests/taxonomy-request-http";

export const dynamic = "force-dynamic";

/** The signed-in member's own requests for new list entries. */
export async function GET(): Promise<Response> {
  return taxonomyRequestResponse(await listOwnTaxonomyRequests());
}

/** Asks a Sheriff to add a campus, faculty, programme, course, session, type or tag. */
export async function POST(request: Request): Promise<Response> {
  const parsed = await readJson(request);
  if (!parsed.ok) {
    return taxonomyRequestResponse({ ok: false, code: "VALIDATION_ERROR" });
  }
  return taxonomyRequestResponse(await submitTaxonomyRequest(parsed.body));
}
