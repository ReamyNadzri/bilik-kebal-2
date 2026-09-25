import { decideTaxonomyRequest } from "@/modules/taxonomy-requests/loaders/taxonomy-request-operations";
import {
  readJson,
  taxonomyRequestResponse,
} from "@/modules/taxonomy-requests/taxonomy-request-http";

export const dynamic = "force-dynamic";

/** A Sheriff adds the requested entry to the shared lists, or declines it. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const parsed = await readJson(request);
  if (!parsed.ok) {
    return taxonomyRequestResponse({ ok: false, code: "VALIDATION_ERROR" });
  }
  return taxonomyRequestResponse(await decideTaxonomyRequest(id, parsed.body));
}
