import { duelJson } from "@/modules/duel/duel-http";
import { recordDuelPractice } from "@/modules/duel/loaders/duel-operations";

export const dynamic = "force-dynamic";

/** Records one shot on the practice field. */
export async function POST(request: Request): Promise<Response> {
  return duelJson(request, recordDuelPractice);
}
