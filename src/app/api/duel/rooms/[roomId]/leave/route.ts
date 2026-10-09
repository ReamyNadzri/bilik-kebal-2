import { duelResponse } from "@/modules/duel/duel-http";
import { leaveDuelRoom } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** Leaves the room; after SHOOT! of an undecided duel, leaving loses it. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
): Promise<Response> {
  const { roomId } = await params;
  return duelResponse(await leaveDuelRoom(roomId));
}
