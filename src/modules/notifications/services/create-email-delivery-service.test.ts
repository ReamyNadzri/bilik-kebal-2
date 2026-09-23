import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  providerOptions: undefined as Record<string, unknown> | undefined,
}));

vi.mock("../adapters/brevo-email-provider", () => ({
  BrevoNotificationEmailProvider: class {
    constructor(options: Record<string, unknown>) {
      mocks.providerOptions = options;
    }
  },
}));
vi.mock("../repositories/supabase-notification-email-outbox-repository", () => ({
  SupabaseNotificationEmailOutboxRepository: class {},
}));
vi.mock("./email-delivery-service", () => ({
  NotificationEmailDeliveryService: class {},
}));

import { createEmailDeliveryService } from "./create-email-delivery-service";

beforeEach(() => {
  vi.stubEnv("BREVO_API_KEY", "test-api-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://vaultix.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.stubEnv("BREVO_FROM_EMAIL", undefined);
  vi.stubEnv("BREVO_FROM_NAME", undefined);
  mocks.providerOptions = undefined;
});

test("uses the verified Brevo sender when no sender override is configured", () => {
  createEmailDeliveryService();

  expect(mocks.providerOptions).toMatchObject({
    fromEmail: "noreply@bilikkebal.afes.my",
    fromName: "VAULTIX",
  });
});
