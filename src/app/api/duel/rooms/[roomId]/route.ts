import { duelResponse } from "@/modules/duel/duel-http";
import { readDuelRoom } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** The room now, with the server's clock. Reading it keeps the member present. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
): Promise<Response> {
  const { roomId } = await params;
  return duelResponse(await readDuelRoom(roomId));
}
