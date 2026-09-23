import { randomUUID } from "node:crypto";

export type OperationName =
  | "identity.sign_in"
  | "identity.sign_up"
  | "identity.resend_verification"
  | "identity.recover_password"
  | "identity.reset_password"
  | "identity.sign_out"
  | "notifications.list"
  | "notifications.read"
  | "notifications.email_dispatch";

/** Construct an allowlisted record instead of serialising arbitrary request/error objects. */
export function beginOperation(
  operation: OperationName,
  sink: (line: string) => void = console.info,
  correlationId: string = randomUUID(),
) {
  const started = performance.now();
  return {
    correlationId,
    finish(status: number) {
      const record = {
        correlationId,
        operation,
        status,
        outcome: status < 400 ? "success" : status < 500 ? "refused" : "unavailable",
        durationMs: Math.max(0, Math.round(performance.now() - started)),
      };
      try {
        sink(JSON.stringify(record));
      } catch {
        /* Logging failure must not change operation outcome. */
      }
    },
  };
}
