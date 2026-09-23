import { timingSafeEqual } from "node:crypto";
import { beginOperation } from "@/lib/observability/operation-log";
import type { NotificationEmailDeliveryCount } from "../services/email-delivery-service";

function matchesSecret(candidate: string | null, expected: string): boolean {
  if (!candidate) return false;
  const candidateBytes = Buffer.from(candidate, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes)
  );
}

export async function notificationEmailDispatchHttp(
  request: Request,
  dependencies: {
    serviceRoleKey: string | undefined;
    dispatch: () => Promise<NotificationEmailDeliveryCount>;
  },
): Promise<Response> {
  const trace = beginOperation("notifications.email_dispatch");
  if (request.method !== "POST") {
    trace.finish(405);
    return Response.json(
      { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use POST for this operation." },
      { status: 405, headers: { Allow: "POST", "X-Correlation-ID": trace.correlationId } },
    );
  }
  if (!dependencies.serviceRoleKey) {
    trace.finish(503);
    return Response.json(
      { ok: false, code: "DISPATCH_UNAVAILABLE", message: "Email dispatch is unavailable." },
      { status: 503, headers: { "X-Correlation-ID": trace.correlationId } },
    );
  }
  if (
    !matchesSecret(
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
      dependencies.serviceRoleKey,
    )
  ) {
    trace.finish(401);
    return Response.json(
      { ok: false, code: "AUTH_REQUIRED", message: "This operation is not available." },
      { status: 401, headers: { "X-Correlation-ID": trace.correlationId } },
    );
  }

  try {
    const result = await dependencies.dispatch();
    trace.finish(200);
    return Response.json(
      { ok: true, data: result },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Correlation-ID": trace.correlationId,
        },
      },
    );
  } catch {
    trace.finish(503);
    return Response.json(
      { ok: false, code: "DISPATCH_UNAVAILABLE", message: "Email dispatch is unavailable." },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Correlation-ID": trace.correlationId,
        },
      },
    );
  }
}
