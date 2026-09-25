import { z } from "zod";
import {
  notificationKinds,
  notificationMessages,
  type NotificationListResult,
  type NotificationReadResult,
} from "@/contracts/notifications";

const instant = z.string().datetime({ offset: true });
const cursorSchema = z.object({ createdAt: instant, id: z.uuid() }).strict();
export const notificationRowSchema = z.object({
  id: z.uuid(),
  kind: z.enum(notificationKinds),
  subject_id: z.uuid(),
  created_at: instant,
  read_at: instant.nullable(),
});
export type NotificationRow = z.infer<typeof notificationRowSchema>;
export interface InboxQuery {
  limit: number;
  cursor: z.infer<typeof cursorSchema> | null;
}
export interface NotificationRepository {
  list(query: InboxQuery): Promise<NotificationRow[]>;
  markRead(id: string): Promise<boolean>;
  markAllRead(): Promise<number>;
}

/** Authenticated composition supplies a session-scoped repository, never an admin client. */
export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  async list(input: unknown): Promise<NotificationListResult> {
    const parsed = z
      .object({
        limit: z.coerce.number().int().min(1).max(50).default(20),
        cursor: z.string().min(1).max(512).optional(),
      })
      .strict()
      .safeParse(input);
    if (!parsed.success)
      return { ok: false, code: "VALIDATION_ERROR", message: "Invalid notification query." };
    let cursor: InboxQuery["cursor"] = null;
    if (parsed.data.cursor) {
      try {
        cursor = cursorSchema.parse(
          JSON.parse(Buffer.from(parsed.data.cursor, "base64url").toString("utf8")),
        );
      } catch {
        return { ok: false, code: "VALIDATION_ERROR", message: "Invalid notification cursor." };
      }
    }
    try {
      const rows = z
        .array(notificationRowSchema)
        .parse(await this.repository.list({ limit: parsed.data.limit, cursor }));
      const items = rows.slice(0, parsed.data.limit).map((row) => ({
        id: row.id,
        kind: row.kind,
        message: notificationMessages[row.kind],
        subjectId: row.subject_id,
        createdAt: row.created_at,
        readAt: row.read_at,
      }));
      const last = items.at(-1);
      const nextCursor =
        rows.length > parsed.data.limit && last
          ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString(
              "base64url",
            )
          : null;
      return { ok: true, data: { items, nextCursor } };
    } catch {
      return {
        ok: false,
        code: "NOTIFICATIONS_UNAVAILABLE",
        message: "Notifications are temporarily unavailable.",
      };
    }
  }

  /** `{ id }` marks one notification read; `{ all: true }` marks every unread one. */
  async markRead(input: unknown): Promise<NotificationReadResult> {
    const parsed = z
      .union([z.object({ id: z.uuid() }).strict(), z.object({ all: z.literal(true) }).strict()])
      .safeParse(input);
    if (!parsed.success)
      return { ok: false, code: "VALIDATION_ERROR", message: "Invalid notification identifier." };
    try {
      if ("all" in parsed.data) {
        await this.repository.markAllRead();
        return { ok: true, data: { read: true } };
      }
      if (!(await this.repository.markRead(parsed.data.id))) {
        return { ok: false, code: "REQUEST_NOT_FOUND", message: "Notification not found." };
      }
      return { ok: true, data: { read: true } };
    } catch {
      return {
        ok: false,
        code: "NOTIFICATIONS_UNAVAILABLE",
        message: "Notifications are temporarily unavailable.",
      };
    }
  }
}
