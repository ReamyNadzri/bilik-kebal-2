import {
  parseServerEnv,
  getMarketplaceTokenSecret,
  getToyyibPayCallbackSecret,
} from "@/lib/config/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SupabaseIdentityReadRepository } from "@/modules/identity/repositories/supabase-identity-read-repository";
import { SupabaseWantedRepository } from "@/modules/wanted/repositories/supabase-wanted-repository";
import type { WantedActor } from "@/modules/wanted/domain/wanted-policy";
import { ContributionService } from "../services/contribution-service";
import { SupabaseMoneyRepository } from "../repositories/supabase-money-repository";
import {
  HttpToyyibPayGateway,
  ToyyibPayAdapter,
  type ToyyibPayGateway,
} from "../providers/toyyibpay";
import { providerCallbackSchema } from "@/contracts/money";
import { failure } from "@/contracts/operation-result";

const unavailableGateway: ToyyibPayGateway = {
  async createBill() {
    throw new Error("ToyyibPay gateway is not configured");
  },
};

function configuredGateway(env: ReturnType<typeof parseServerEnv>): ToyyibPayGateway {
  const secret = env.TOYYIBPAY_SANDBOX_SECRET ?? env.TOYYIBPAY_LIVE_SECRET;
  const categoryCode = env.TOYYIBPAY_CATEGORY_CODE;
  const callbackUrl = env.TOYYIBPAY_CALLBACK_URL;
  const returnUrl = env.TOYYIBPAY_RETURN_URL;
  if (!secret || !categoryCode || !callbackUrl || !returnUrl) return unavailableGateway;
  return new HttpToyyibPayGateway({
    baseUrl: env.PAYMENT_MODE === "sandbox" ? "https://dev.toyyibpay.com" : "https://toyyibpay.com",
    callbackUrl,
    categoryCode,
    returnUrl,
    userSecretKey: secret,
  });
}

async function loadContext() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  const wantedRepository = new SupabaseWantedRepository(client);
  const repository = new SupabaseMoneyRepository(client, wantedRepository);
  const env = parseServerEnv(process.env);
  const provider = new ToyyibPayAdapter(configuredGateway(env), {
    merchantCode: env.TOYYIBPAY_MERCHANT_CODE ?? "unconfigured",
    secret: env.TOYYIBPAY_SANDBOX_SECRET ?? env.TOYYIBPAY_LIVE_SECRET ?? "unconfigured",
  });
  if (error || !user)
    return {
      actor: null as WantedActor | null,
      service: new ContributionService(repository, provider, {
        paymentMode: env.PAYMENT_MODE,
        tokenSecret: getMarketplaceTokenSecret(process.env),
      }),
    };
  const account = await new SupabaseIdentityReadRepository(client).readAccount(user);
  const actor: WantedActor = account
    ? {
        emailVerified: Boolean(user.email_confirmed_at),
        institutionId: account.institution?.id ?? null,
        institutionVerified: account.institutionVerificationState === "verified",
        restricted: account.hasActiveRestriction,
        userId: user.id,
      }
    : {
        emailVerified: Boolean(user.email_confirmed_at),
        institutionId: null,
        institutionVerified: false,
        restricted: false,
        userId: user.id,
      };
  return {
    actor,
    service: new ContributionService(repository, provider, {
      paymentMode: env.PAYMENT_MODE,
      tokenSecret: getMarketplaceTokenSecret(process.env),
    }),
  };
}

export async function createContributionIntent(draftId: string, input: unknown) {
  try {
    const loaded = await loadContext();
    const trustedInput =
      typeof input === "object" && input !== null && !Array.isArray(input)
        ? { ...input, draftId }
        : input;
    return loaded.service.createIntent(loaded.actor, trustedInput);
  } catch {
    return failure(
      "PAYMENT_UNAVAILABLE" as const,
      "Payment preparation is temporarily unavailable.",
    );
  }
}

export async function handleToyyibPayCallback(input: unknown) {
  const parsed = providerCallbackSchema.safeParse(input);
  if (!parsed.success)
    return failure("PAYMENT_CALLBACK_INVALID" as const, "Callback payload was invalid.");
  try {
    const admin = createSupabaseAdminClient();
    const wantedRepository = new SupabaseWantedRepository(admin);
    const repository = new SupabaseMoneyRepository(admin, wantedRepository);
    const env = parseServerEnv(process.env);
    const callbackSecret = getToyyibPayCallbackSecret(process.env);
    const provider = new ToyyibPayAdapter(configuredGateway(env), {
      merchantCode: env.TOYYIBPAY_MERCHANT_CODE ?? "unconfigured",
      secret: callbackSecret,
    });
    const service = new ContributionService(repository, provider, {
      paymentMode: env.PAYMENT_MODE,
      tokenSecret: getMarketplaceTokenSecret(process.env),
    });
    return service.handleCallback(parsed.data);
  } catch {
    return failure("MONEY_UNAVAILABLE" as const, "Payment events are temporarily unavailable.");
  }
}
