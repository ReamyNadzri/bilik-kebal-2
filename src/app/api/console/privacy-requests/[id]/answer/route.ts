import { legalJson } from "@/modules/legal/legal-http";
import { answerPrivacyRequest } from "@/modules/legal/loaders/legal-operations";

export const dynamic = "force-dynamic";

/** The Owner answers a privacy request; the member reads the answer on their profile. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return legalJson(request, (input) => answerPrivacyRequest(id, input));
}
