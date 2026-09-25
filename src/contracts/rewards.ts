import { z } from "zod";
import type { OperationResult } from "./operation-result";

/**
 * Reward codes add free requests. A code has a word, a number of free requests
 * per redemption and a maximum number of redemptions; each member may redeem
 * a code once. Codes are created by the Owner.
 */
export const redeemRewardCodeInputSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{3,32}$/),
});
export type RedeemRewardCodeInput = z.input<typeof redeemRewardCodeInputSchema>;

export type RewardCodeOutcome =
  "redeemed" | "invalid" | "already_redeemed" | "exhausted" | "rate_limited";

export type RewardCodeOperationCode =
  "AUTH_REQUIRED" | "EMAIL_NOT_VERIFIED" | "VALIDATION_ERROR" | "REWARDS_UNAVAILABLE";

export const REWARD_CODE_MESSAGES: Readonly<Record<RewardCodeOutcome, string>> = {
  redeemed: "Code redeemed. Your free requests have been added.",
  invalid: "That code is not valid or has expired. Check the spelling and try again.",
  already_redeemed: "You have already redeemed this code. Each code works once per member.",
  exhausted: "This code has been used the maximum number of times.",
  rate_limited: "Too many attempts. Wait an hour, then try again.",
};

export type RedeemRewardCodeResult = OperationResult<
  { outcome: RewardCodeOutcome; remaining: number },
  RewardCodeOperationCode
>;
