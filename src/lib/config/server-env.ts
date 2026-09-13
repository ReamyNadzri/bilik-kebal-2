import { z } from "zod";

export const paymentModes = ["disabled", "sandbox", "live_limited"] as const;
export type PaymentMode = (typeof paymentModes)[number];

const booleanEnv = z.preprocess((value: unknown) => {
  if (value === undefined) return false;
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return value;
}, z.boolean());

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PAYMENT_MODE: z.enum(paymentModes).default("disabled"),
  PUBLIC_UPLOADS_ENABLED: booleanEnv,
  TOYYIBPAY_SANDBOX_SECRET: z.string().min(1).optional(),
  TOYYIBPAY_LIVE_SECRET: z.string().min(1).optional(),
  LIVE_TESTER_ALLOWLIST: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function parseServerEnv(input: Record<string, unknown>): ServerEnv {
  const parsed = serverSchema.parse(input);

  if (parsed.PAYMENT_MODE === "sandbox" && !parsed.TOYYIBPAY_SANDBOX_SECRET) {
    throw new Error("TOYYIBPAY_SANDBOX_SECRET is required when PAYMENT_MODE is sandbox");
  }

  if (
    parsed.PAYMENT_MODE === "live_limited" &&
    (!parsed.TOYYIBPAY_LIVE_SECRET || !parsed.LIVE_TESTER_ALLOWLIST)
  ) {
    throw new Error(
      "TOYYIBPAY_LIVE_SECRET and LIVE_TESTER_ALLOWLIST are required when PAYMENT_MODE is live_limited",
    );
  }

  return parsed;
}
