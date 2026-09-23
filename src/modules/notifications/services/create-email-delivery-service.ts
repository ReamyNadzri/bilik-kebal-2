import { resolveSupabasePublicConfig } from "@/lib/config/public-env";
import { BrevoNotificationEmailProvider } from "../adapters/brevo-email-provider";
import { SupabaseNotificationEmailOutboxRepository } from "../repositories/supabase-notification-email-outbox-repository";
import { NotificationEmailDeliveryService } from "./email-delivery-service";

const defaultSenderEmail = "noreply@bilikkebal.afes.my";

/** Wires server-only credentials to the durable outbox and replaceable mail provider. */
export function createEmailDeliveryService(): NotificationEmailDeliveryService {
  const apiKey = process.env.BREVO_API_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !serviceRoleKey) throw new Error("Email dispatch configuration is unavailable");
  const supabase = resolveSupabasePublicConfig(process.env);
  return new NotificationEmailDeliveryService({
    repository: new SupabaseNotificationEmailOutboxRepository({
      baseUrl: supabase.url,
      serviceRoleKey,
    }),
    provider: new BrevoNotificationEmailProvider({
      apiKey,
      fromEmail: process.env.BREVO_FROM_EMAIL ?? defaultSenderEmail,
      fromName: process.env.BREVO_FROM_NAME ?? "VAULTIX",
    }),
  });
}
