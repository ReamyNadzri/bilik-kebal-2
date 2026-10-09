import { duelResponse } from "@/modules/duel/duel-http";
import { claimDuelTopic } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** Claims this month's free requests for a finished topic; they expire a month later. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ topic: string }> },
): Promise<Response> {
  const { topic } = await params;
  return duelResponse(await claimDuelTopic(decodeURIComponent(topic)));
}
