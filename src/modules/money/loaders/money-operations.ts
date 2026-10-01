import {
  parseServerEnv,
  getMarketplaceTokenSecret,
  getMockGatewaySecret,
  getToyyibPayCallbackSecret,
} from "@/lib/config/server-env";
import { createSupabaseServerClient, getRequestUser } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SupabaseIdentityReadRepository } from "@/modules/identity/repositories/supabase-identity-read-repository";
import { SupabaseWantedRepository } from "@/modules/wanted/repositories/supabase-wanted-repository";
import type { WantedActor } from "@/modules/wanted/domain/wanted-policy";
import { ContributionService, MockCheckoutService } from "../services/contribution-service";
import { SupabaseMoneyRepository } from "../repositories/supabase-money-repository";
import {
  HttpToyyibPayGateway,
  ToyyibPayAdapter,
  type ToyyibPayGateway,
} from "../providers/toyyibpay";
import { MockPaymentGateway } from "../providers/mock-gateway";
import type { PaymentProvider } from "../providers/payment-provider";
import { providerCallbackSchema } from "@/contracts/money";
import { failure } from "@/contracts/operation-result";

type ServerEnv = ReturnType<typeof parseServerEnv>;

const unavailableGateway: ToyyibPayGateway = {
  async createBill() {
    throw new Error("ToyyibPay gateway is not configured");
  },
};

function configuredGateway(env: ServerEnv): ToyyibPayGateway {
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

function mockGateway(): MockPaymentGateway {
  return new MockPaymentGateway({ secret: getMockGatewaySecret(process.env) });
}

/**
 * The one place the gateway for new bills is chosen: PAYMENT_MODE=mock uses
 * the test gateway, sandbox and live_limited use ToyyibPay.
 */
function paymentProvider(env: ServerEnv): PaymentProvider {
  if (env.PAYMENT_MODE === "mock") return mockGateway();
  return new ToyyibPayAdapter(configuredGateway(env), {
    merchantCode: env.TOYYIBPAY_MERCHANT_CODE ?? "unconfigured",
    secret: env.TOYYIBPAY_SANDBOX_SECRET ?? env.TOYYIBPAY_LIVE_SECRET ?? "unconfigured",
  });
}

async function loadContext() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await getRequestUser();
  const wantedRepository = new SupabaseWantedRepository(client);
  const repository = new SupabaseMoneyRepository(client, wantedRepository);
  const env = parseServerEnv(process.env);
  const service = new ContributionService(repository, paymentProvider(env), {
    paymentMode: env.PAYMENT_MODE,
    tokenSecret: getMarketplaceTokenSecret(process.env),
  });
  if (error || !user) return { actor: null as WantedActor | null, env, repository, service };
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
  return { actor, env, repository, service };
}

/** Verifies provider events with the privileged client; never reachable by a browser session. */
function ledgerService(provider: PaymentProvider, env: ServerEnv): ContributionService {
  const admin = createSupabaseAdminClient();
  const repository = new SupabaseMoneyRepository(admin, new SupabaseWantedRepository(admin));
  return new ContributionService(repository, provider, {
    paymentMode: env.PAYMENT_MODE,
    tokenSecret: getMarketplaceTokenSecret(process.env),
  });
}

const unavailable = () =>
  failure("PAYMENT_UNAVAILABLE" as const, "Payment preparation is temporarily unavailable.");

export async function createContributionIntent(draftId: string, input: unknown) {
  try {
    const loaded = await loadContext();
    const trustedInput =
      typeof input === "object" && input !== null && !Array.isArray(input)
        ? { ...input, draftId }
        : input;
    return loaded.service.createIntent(loaded.actor, trustedInput);
  } catch {
    return unavailable();
  }
}

/** Backing the open Wanted with public id `wantedId`. */
export async function createBackingIntent(wantedId: string, input: unknown) {
  try {
    const loaded = await loadContext();
    const trustedInput =
      typeof input === "object" && input !== null && !Array.isArray(input)
        ? { ...input, wantedId }
        : input;
    return loaded.service.createBackingIntent(loaded.actor, trustedInput);
  } catch {
    return unavailable();
  }
}

/** The signed-in payer's own bill, for the checkout and return pages. */
export async function readOwnPaymentBill(billCode: string) {
  try {
    const loaded = await loadContext();
    return loaded.service.readBill(loaded.actor, billCode);
  } catch {
    return failure("MONEY_UNAVAILABLE" as const, "Payments are temporarily unavailable.");
  }
}

/** The test gateway's checkout button: pay or cancel the payer's own bill. */
export async function completeMockCheckout(billCode: string, outcome: "paid" | "cancelled") {
  try {
    const loaded = await loadContext();
    const gateway = mockGateway();
    const checkout = new MockCheckoutService(
      loaded.repository,
      {
        handleCallback: (callback) => ledgerService(gateway, loaded.env).handleCallback(callback),
      },
      gateway,
      { paymentMode: loaded.env.PAYMENT_MODE },
    );
    return checkout.complete(loaded.actor, billCode, outcome);
  } catch {
    return failure("MONEY_UNAVAILABLE" as const, "Payments are temporarily unavailable.");
  }
}

export async function handleToyyibPayCallback(input: unknown) {
  const parsed = providerCallbackSchema.safeParse(input);
  if (!parsed.success)
    return failure("PAYMENT_CALLBACK_INVALID" as const, "Callback payload was invalid.");
  try {
    const env = parseServerEnv(process.env);
    // Always ToyyibPay, whatever the current mode: a callback for a bill made
    // before the mode changed is still money received.
    const provider = new ToyyibPayAdapter(configuredGateway(env), {
      merchantCode: env.TOYYIBPAY_MERCHANT_CODE ?? "unconfigured",
      secret: getToyyibPayCallbackSecret(process.env),
    });
    return ledgerService(provider, env).handleCallback(parsed.data);
  } catch {
    return failure("MONEY_UNAVAILABLE" as const, "Payment events are temporarily unavailable.");
  }
}
