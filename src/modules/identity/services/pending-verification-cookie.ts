import { createHmac, timingSafeEqual } from "node:crypto";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export async function encodePendingEmail(email: string, secret: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const payload = Buffer.from(normalized, "utf8").toString("base64url");
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export async function decodePendingEmail(value: string, secret: string): Promise<string | null> {
  const [payload, providedSignature, extra] = value.split(".");
  if (!payload || !providedSignature || extra) return null;
  const provided = Buffer.from(providedSignature, "base64url");
  const expected = signature(payload, secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  const email = Buffer.from(payload, "base64url").toString("utf8");
  return emailPattern.test(email) && email.length <= 254 ? email : null;
}
