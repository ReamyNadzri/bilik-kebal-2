import { duelJson } from "@/modules/duel/duel-http";
import { finishDuel } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** Closes a duel with the member's reaction; the database decides the outcome. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> },
): Promise<Response> {
  const { roundId } = await params;
  return duelJson(request, (input) => finishDuel(roundId, input));
}
