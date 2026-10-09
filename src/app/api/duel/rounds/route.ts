import { duelJson } from "@/modules/duel/duel-http";
import { startDuel } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** Opens a duel against a member's ghost; the database draws the ghost's time. */
export async function POST(request: Request): Promise<Response> {
  return duelJson(request, startDuel);
}
