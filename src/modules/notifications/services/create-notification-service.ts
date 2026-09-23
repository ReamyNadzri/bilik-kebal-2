import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  SupabaseNotificationRepository,
  type NotificationDatabase,
} from "../repositories/supabase-notification-repository";
import { NotificationService } from "./notification-service";

export async function createNotificationService(): Promise<NotificationService | null> {
  const client = await createSupabaseServerClient<NotificationDatabase>();
  const { data, error } = await client.auth.getUser();
  if (error) {
    if (error.name === "AuthSessionMissingError") return null;
    throw new Error("Notification authentication unavailable");
  }
  if (!data.user) return null;
  return new NotificationService(new SupabaseNotificationRepository(client));
}
