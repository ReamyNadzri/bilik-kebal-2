import { duelResponse } from "@/modules/duel/duel-http";
import { claimDuelAchievement } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** Claims this month's free request for a finished reward achievement. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ achievementId: string }> },
): Promise<Response> {
  const { achievementId } = await params;
  return duelResponse(await claimDuelAchievement(achievementId));
}
