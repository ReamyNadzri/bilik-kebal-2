import { duelResponse } from "@/modules/duel/duel-http";
import { resetDuelRecord } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** Wipes the member's own Duel record. */
export async function DELETE(): Promise<Response> {
  return duelResponse(await resetDuelRecord());
}
