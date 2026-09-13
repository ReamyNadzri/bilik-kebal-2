import { parseServerEnv } from "./server-env";

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
