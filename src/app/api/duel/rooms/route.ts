import { duelResponse } from "@/modules/duel/duel-http";
import { listOpenDuelRooms, openDuelRoom } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** Rooms waiting for a challenger. */
export async function GET(): Promise<Response> {
  return duelResponse(await listOpenDuelRooms());
}

/** Opens a room for the signed-in member. */
export async function POST(): Promise<Response> {
  return duelResponse(await openDuelRoom());
}
