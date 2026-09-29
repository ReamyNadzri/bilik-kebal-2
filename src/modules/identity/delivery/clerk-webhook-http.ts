import { beginOperation } from "@/lib/observability/operation-log";

import type { ClerkWebhookEventLike, ClerkWebhookOutcome } from "../services/clerk-user-sync";

/**
 * Clerk → VAULTIX user webhook.
 *
 * Status codes drive Svix's retries: 2xx is final, anything else is retried
 * with backoff. So a bad signature is refused (400) and a failed sync is 503,
 * which the idempotent database function makes safe to repeat. Nothing from
 * the payload is logged — it carries email addresses.
 */
export async function clerkWebhookHttp(
  request: Request,
  dependencies: {
    verify: (request: Request) => Promise<ClerkWebhookEventLike>;
    handle: (event: ClerkWebhookEventLike) => Promise<ClerkWebhookOutcome>;
  },
): Promise<Response> {
  const trace = beginOperation("identity.clerk_webhook");
  const headers = { "Cache-Control": "private, no-store", "X-Correlation-ID": trace.correlationId };

  if (request.method !== "POST") {
    trace.finish(405);
    return Response.json(
      { ok: false, code: "METHOD_NOT_ALLOWED", message: "Use POST for this operation." },
      { status: 405, headers: { ...headers, Allow: "POST" } },
    );
  }

  let event: ClerkWebhookEventLike;
  try {
    event = await dependencies.verify(request);
  } catch {
    trace.finish(400);
    return Response.json(
      {
        ok: false,
        code: "WEBHOOK_SIGNATURE_INVALID",
        message: "The webhook could not be verified.",
      },
      { status: 400, headers },
    );
  }

  try {
    const outcome = await dependencies.handle(event);
    trace.finish(200);
    return Response.json({ ok: true, data: { outcome } }, { headers });
  } catch {
    trace.finish(503);
    return Response.json(
      { ok: false, code: "IDENTITY_SYNC_UNAVAILABLE", message: "The account could not be synced." },
      { status: 503, headers },
    );
  }
}
