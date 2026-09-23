import { beginOperation } from "@/lib/observability/operation-log";
import type { NotificationListResult, NotificationReadResult } from "@/contracts/notifications";
import { createNotificationService } from "../services/create-notification-service";

type Result = NotificationListResult | NotificationReadResult;
const statusByCode = {
  AUTH_REQUIRED: 401,
  NOTIFICATIONS_UNAVAILABLE: 503,
  VALIDATION_ERROR: 400,
  REQUEST_NOT_FOUND: 404,
} as const;

export async function notificationHttp(
  request: Request,
  operation: "list" | "read",
): Promise<Response> {
  const trace = beginOperation(operation === "list" ? "notifications.list" : "notifications.read");
  let result: Result;
  try {
    const service = await createNotificationService();
    if (!service)
      result = { ok: false, code: "AUTH_REQUIRED", message: "Sign in to view notifications." };
    else if (operation === "list") {
      const query = new URL(request.url).searchParams;
      result = await service.list(Object.fromEntries(query));
    } else {
      let input: unknown;
      try {
        input = await request.json();
      } catch {
        input = null;
      }
      result = await service.markRead(input);
    }
  } catch {
    result = {
      ok: false,
      code: "NOTIFICATIONS_UNAVAILABLE",
      message: "Notifications are temporarily unavailable.",
    };
  }
  const status = result.ok ? 200 : statusByCode[result.code];
  trace.finish(status);
  return Response.json(result, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Correlation-ID": trace.correlationId,
    },
  });
}
