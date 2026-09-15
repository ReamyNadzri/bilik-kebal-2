import {
  getMarketplaceTokenSecret,
  getToyyibPayCallbackSecret,
  parseServerEnv,
} from "./server-env";

test("defaults risky providers to disabled", () => {
  const env = parseServerEnv({ NODE_ENV: "test" });

  expect(env.PAYMENT_MODE).toBe("disabled");
  expect(env.PUBLIC_UPLOADS_ENABLED).toBe(false);
});

test("requires sandbox credentials only when sandbox payments are enabled", () => {
  expect(() => parseServerEnv({ NODE_ENV: "test", PAYMENT_MODE: "sandbox" })).toThrow(
    /TOYYIBPAY_SANDBOX_SECRET/,
  );
});

test("requires a dedicated marketplace token secret in production", () => {
  expect(() => getMarketplaceTokenSecret({ NODE_ENV: "production" })).toThrow(
    /MARKETPLACE_TOKEN_SECRET/,
  );
  expect(
    getMarketplaceTokenSecret({
      NODE_ENV: "production",
      MARKETPLACE_TOKEN_SECRET: "a-secure-marketplace-token-secret-value",
    }),
  ).toBe("a-secure-marketplace-token-secret-value");
});

test("never fabricates a ToyyibPay callback secret while payments are disabled", () => {
  expect(() => getToyyibPayCallbackSecret({ NODE_ENV: "test" })).toThrow(
    /ToyyibPay callback secret/,
  );
  expect(
    getToyyibPayCallbackSecret({
      NODE_ENV: "test",
      TOYYIBPAY_SANDBOX_SECRET: "sandbox-secret",
    }),
  ).toBe("sandbox-secret");
});
