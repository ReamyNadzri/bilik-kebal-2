import { duelResponse } from "@/modules/duel/duel-http";
import { loadDuelLobby } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** The signed-in member's Duel record and the ghosts they may challenge. */
export async function GET(): Promise<Response> {
  return duelResponse(await loadDuelLobby());
}
