import { legalJson, legalResponse } from "@/modules/legal/legal-http";
import {
  listOwnPrivacyRequests,
  submitPrivacyRequest,
} from "@/modules/legal/loaders/legal-operations";

export const dynamic = "force-dynamic";

/** The signed-in member's own privacy requests and their answers. */
export async function GET(): Promise<Response> {
  return legalResponse(await listOwnPrivacyRequests());
}

/** Sends a privacy request to the Owner. */
export async function POST(request: Request): Promise<Response> {
  return legalJson(request, submitPrivacyRequest);
}
