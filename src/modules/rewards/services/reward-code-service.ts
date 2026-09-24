import { failure, success } from "@/contracts/operation-result";
import {
  redeemRewardCodeInputSchema,
  type RedeemRewardCodeResult,
  type RewardCodeOutcome,
} from "@/contracts/rewards";

export interface RewardCodeRepository {
  redeem(code: string): Promise<RewardCodeOutcome>;
  remainingFreeRequests(): Promise<number>;
}

export interface RewardActor {
  readonly userId: string;
  readonly emailVerified: boolean;
}

const OUTCOMES: readonly RewardCodeOutcome[] = [
  "redeemed",
  "invalid",
  "already_redeemed",
  "exhausted",
  "rate_limited",
];

/**
 * Redeems a reward code for extra free requests. A refusal (wrong code, used
 * already, used up, too many tries) is an answer, not an error: the database
 * records the attempt and returns the outcome, so the member is told which.
 */
export class RewardCodeService {
  constructor(private readonly repository: RewardCodeRepository) {}

  async redeem(actor: RewardActor | null, input: unknown): Promise<RedeemRewardCodeResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to redeem a code.");
    if (!actor.emailVerified) return failure("EMAIL_NOT_VERIFIED", "Verify your email first.");
    const parsed = redeemRewardCodeInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "Codes are 3 to 32 letters, numbers or dashes.");
    }
    try {
      const raw = await this.repository.redeem(parsed.data.code);
      const outcome = OUTCOMES.includes(raw) ? raw : "invalid";
      return success({ outcome, remaining: await this.repository.remainingFreeRequests() });
    } catch {
      return failure("REWARDS_UNAVAILABLE", "Codes cannot be redeemed right now. Try again.");
    }
  }
}
