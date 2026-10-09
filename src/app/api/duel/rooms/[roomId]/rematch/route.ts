import { duelResponse } from "@/modules/duel/duel-http";
import { rematchDuelRoom } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** Asks for a rematch; the next duel starts once both have asked. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
): Promise<Response> {
  const { roomId } = await params;
  return duelResponse(await rematchDuelRoom(roomId));
}
