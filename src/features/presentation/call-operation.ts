"use client";

import type { OperationResult } from "@/contracts";
import { reportSessionExpired } from "./auth/session-expiry";

/**
 * Calls a backend operation and returns its typed result.
 *
 * Every route answers with the same envelope, so a transport failure is
 * reported in that shape too rather than thrown: a screen must be able to show
 * a network failure with the same code path it uses for a refusal.
 *
 * The caller maps codes to copy. This helper never invents a message, because
 * the message a user reads about their account must come from the operation
 * that made the decision.
 *
 * Credentials travel as the Supabase session cookie the browser already holds.
 * Nothing here reads or attaches a token, because no token is available to
 * read: the session is HTTP-only by design, so a cross-site script cannot
 * lift it (context/architecture.md).
 */
export async function callOperation<TData, TCode extends string>(
  path: string,
  body: unknown,
  unavailableCode: TCode,
  /** Select an explicit write method; defaults to `POST` for create actions. */
  method: "POST" | "PUT" | "PATCH" = "POST",
): Promise<OperationResult<TData, TCode>> {
  return requestOperation<TData, TCode>(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    unavailableCode,
  );
}

/**
 * Reads a backend operation that takes no body.
 *
 * Reads are as capable of losing a session as writes are, so they go through
 * the same envelope and the same expiry reporting rather than around them.
 */
export async function readOperation<TData, TCode extends string>(
  path: string,
  unavailableCode: TCode,
): Promise<OperationResult<TData, TCode>> {
  return requestOperation<TData, TCode>(
    path,
    { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" },
    unavailableCode,
  );
}

async function requestOperation<TData, TCode extends string>(
  path: string,
  init: RequestInit,
  unavailableCode: TCode,
): Promise<OperationResult<TData, TCode>> {
  try {
    const response = await fetch(path, init);

    const payload: unknown = await response.json();

    if (isOperationResult<TData, TCode>(payload)) {
      announceIfSessionExpired(payload);
      return payload;
    }

    return {
      ok: false,
      code: unavailableCode,
      message: "The server returned an unexpected response. Try again shortly.",
    };
  } catch {
    return {
      ok: false,
      code: unavailableCode,
      message: "Could not reach the server. Check your connection and try again.",
    };
  }
}

/**
 * Tells the session watcher that this account is no longer signed in.
 *
 * Deliberately keyed on `AUTH_REQUIRED` alone. `INVALID_CREDENTIALS` and
 * `RECENT_AUTH_REQUIRED` also answer `401`, and neither means the session
 * ended — one is a failed sign-in attempt and the other is a step-up
 * challenge inside a session that is still perfectly valid.
 */
function announceIfSessionExpired(result: OperationResult<unknown, string>): void {
  if (!result.ok && result.code === "AUTH_REQUIRED") {
    reportSessionExpired();
  }
}

function isOperationResult<TData, TCode extends string>(
  value: unknown,
): value is OperationResult<TData, TCode> {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return false;
  }

  const candidate = value as { ok: unknown };

  return typeof candidate.ok === "boolean";
}
