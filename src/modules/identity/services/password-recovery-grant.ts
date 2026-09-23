import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const lifetimeMs = 15 * 60_000;

interface GrantPayload {
  expiresAt: number;
  nonce: string;
  subject: string;
}

function sign(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function createPasswordRecoveryGrant(
  subject: string,
  secret: string,
  now = Date.now(),
): string {
  const payload: GrantPayload = {
    expiresAt: now + lifetimeMs,
    nonce: randomUUID(),
    subject,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded, secret).toString("base64url")}`;
}

export function verifyPasswordRecoveryGrant(
  value: string,
  subject: string,
  secret: string,
  now = Date.now(),
): boolean {
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra) return false;

  const provided = Buffer.from(signature, "base64url");
  const expected = sign(encoded, secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as GrantPayload;
    return (
      payload.subject === subject &&
      typeof payload.expiresAt === "number" &&
      Number.isSafeInteger(payload.expiresAt) &&
      payload.expiresAt > now &&
      typeof payload.nonce === "string" &&
      payload.nonce.length > 0
    );
  } catch {
    return false;
  }
}
