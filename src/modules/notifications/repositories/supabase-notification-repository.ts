import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  notificationRowSchema,
  type InboxQuery,
  type NotificationRepository,
} from "../services/notification-service";

/** Additive RPC contract until local migration validation can regenerate Database. */
export type NotificationDatabase = Database & {
  public: {
    Functions: {
      list_notifications: {
        Args: { page_size: number; before_created_at?: string; before_id?: string };
        Returns: Json;
      };
      mark_notification_read: { Args: { target_notification_id: string }; Returns: boolean };
      mark_all_notifications_read: { Args: Record<string, never>; Returns: number };
    };
  };
};

export class SupabaseNotificationRepository implements NotificationRepository {
  constructor(private readonly client: SupabaseClient<NotificationDatabase>) {}

  async list(query: InboxQuery) {
    const { data, error } = await this.client.rpc("list_notifications", {
      page_size: query.limit,
      ...(query.cursor
        ? { before_created_at: query.cursor.createdAt, before_id: query.cursor.id }
        : {}),
    });
    if (error) throw new Error("Notification list unavailable");
    return z.array(notificationRowSchema).parse(data);
  }

  async markRead(id: string) {
    const { data, error } = await this.client.rpc("mark_notification_read", {
      target_notification_id: id,
    });
    if (error) throw new Error("Notification update unavailable");
    return z.boolean().parse(data);
  }

  async markAllRead() {
    const { data, error } = await this.client.rpc("mark_all_notifications_read");
    if (error) throw new Error("Notification update unavailable");
    return z.number().int().parse(data);
  }
}
