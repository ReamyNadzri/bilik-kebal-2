import { resolveAuthCallbackPath } from "./auth-callback";
import { safeNextPath } from "./auth-http";

export type EmailLinkType = "email" | "recovery";

export interface EmailLinkInput {
  tokenHash: string;
  type: EmailLinkType;
  next: string;
}

const TOKEN_HASH = /^[A-Za-z0-9_-]{1,512}$/;

/** Link parameters are untrusted: only the two types our templates emit are accepted. */
export function parseEmailLinkInput(input: {
  tokenHash: unknown;
  type: unknown;
  next: unknown;
}): EmailLinkInput | null {
  if (typeof input.tokenHash !== "string" || !TOKEN_HASH.test(input.tokenHash)) return null;
  if (input.type !== "email" && input.type !== "recovery") return null;
  const next = safeNextPath(typeof input.next === "string" ? input.next : null, "/profile");
  return { tokenHash: input.tokenHash, type: input.type, next };
}

export function confirmPathFor(input: EmailLinkInput, errorCode: string | null): string {
  return resolveAuthCallbackPath({ errorCode, next: input.next, otpType: input.type });
}
