import { legalJson } from "@/modules/legal/legal-http";
import { acceptTerms } from "@/modules/legal/loaders/legal-operations";

export const dynamic = "force-dynamic";

/** Records that the signed-in member is 18 or older and accepts the current Terms of Use. */
export async function POST(request: Request): Promise<Response> {
  return legalJson(request, acceptTerms);
}
