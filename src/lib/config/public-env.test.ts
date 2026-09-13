import { parsePublicEnv, resolveSupabasePublicConfig } from "./public-env";

test("strips server secrets from browser configuration", () => {
  const env = parsePublicEnv({
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    TOYYIBPAY_LIVE_SECRET: "do-not-expose",
    SUPABASE_SERVICE_ROLE_KEY: "do-not-expose",
  });

  expect(env).toEqual({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" });
  expect(JSON.stringify(env)).not.toMatch(/SECRET|SERVICE_ROLE|TOYYIBPAY/);
});

test("requires a browser-safe Supabase URL and publishable key at the integration boundary", () => {
  expect(
    resolveSupabasePublicConfig({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55421",
    }),
  ).toEqual({
    key: "sb_publishable_test",
    url: "http://127.0.0.1:55421",
  });

  expect(() =>
    resolveSupabasePublicConfig({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }),
  ).toThrow("Supabase public configuration is incomplete");
});
