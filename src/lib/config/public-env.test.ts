import { parsePublicEnv } from "./public-env";

test("strips server secrets from browser configuration", () => {
  const env = parsePublicEnv({
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    TOYYIBPAY_LIVE_SECRET: "do-not-expose",
    SUPABASE_SERVICE_ROLE_KEY: "do-not-expose",
  });

  expect(env).toEqual({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" });
  expect(JSON.stringify(env)).not.toMatch(/SECRET|SERVICE_ROLE|TOYYIBPAY/);
});
