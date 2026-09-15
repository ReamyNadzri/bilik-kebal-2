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
  TOYYIBPAY_MERCHANT_CODE: z.string().min(1).optional(),
  TOYYIBPAY_CATEGORY_CODE: z.string().min(1).optional(),
  TOYYIBPAY_CALLBACK_URL: z.string().url().optional(),
  TOYYIBPAY_RETURN_URL: z.string().url().optional(),
  LIVE_TESTER_ALLOWLIST: z.string().min(1).optional(),
  IDENTITY_PENDING_COOKIE_SECRET: z.string().min(32).optional(),
  MARKETPLACE_TOKEN_SECRET: z.string().min(32).optional(),
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

export function getIdentityPendingCookieSecret(input: Record<string, unknown>): string {
  const env = parseServerEnv(input);
  if (env.IDENTITY_PENDING_COOKIE_SECRET) return env.IDENTITY_PENDING_COOKIE_SECRET;
  if (env.NODE_ENV !== "production") return "vaultix-local-pending-cookie-secret";
  throw new Error("IDENTITY_PENDING_COOKIE_SECRET is required in production");
}

export function getMarketplaceTokenSecret(input: Record<string, unknown>): string {
  const env = parseServerEnv(input);
  if (env.MARKETPLACE_TOKEN_SECRET) return env.MARKETPLACE_TOKEN_SECRET;
  if (env.NODE_ENV !== "production") return "vaultix-local-marketplace-token-secret";
  throw new Error("MARKETPLACE_TOKEN_SECRET is required in production");
}

export function getToyyibPayCallbackSecret(input: Record<string, unknown>): string {
  const env = parseServerEnv(input);
  const secret =
    env.PAYMENT_MODE === "live_limited"
      ? env.TOYYIBPAY_LIVE_SECRET
      : (env.TOYYIBPAY_SANDBOX_SECRET ?? env.TOYYIBPAY_LIVE_SECRET);
  if (secret) return secret;
  throw new Error("A ToyyibPay callback secret is required to verify provider events");
}
