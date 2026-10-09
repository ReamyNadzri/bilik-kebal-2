import { duelJson } from "@/modules/duel/duel-http";
import { joinDuelRoom } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** Joins an open room by its code; the duel starts a few seconds later. */
export async function POST(request: Request): Promise<Response> {
  return duelJson(request, joinDuelRoom);
}
