"use client";

import type { OperationResult } from "@/contracts";

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
 */
export async function callOperation<TData, TCode extends string>(
  path: string,
  body: unknown,
  unavailableCode: TCode,
): Promise<OperationResult<TData, TCode>> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload: unknown = await response.json();

    if (isOperationResult<TData, TCode>(payload)) {
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

function isOperationResult<TData, TCode extends string>(
  value: unknown,
): value is OperationResult<TData, TCode> {
  if (typeof value !== "object" || value === null || !("ok" in value)) {
    return false;
  }

  const candidate = value as { ok: unknown };

  return typeof candidate.ok === "boolean";
}
