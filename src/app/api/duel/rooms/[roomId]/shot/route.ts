import { duelJson } from "@/modules/duel/duel-http";
import { shootInDuelRoom } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** The member's shot, or foul, in the room's current round. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
): Promise<Response> {
  const { roomId } = await params;
  return duelJson(request, (input) => shootInDuelRoom(roomId, input));
}
