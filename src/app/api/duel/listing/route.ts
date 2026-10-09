import { duelJson } from "@/modules/duel/duel-http";
import { setDuelListing } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** Shows or hides the member's ghost in other members' opponent lists. */
export async function PUT(request: Request): Promise<Response> {
  return duelJson(request, setDuelListing);
}
