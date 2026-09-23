import { expect, test } from "vitest";
import {
  createPasswordRecoveryGrant,
  verifyPasswordRecoveryGrant,
} from "./password-recovery-grant";

const secret = "a-secure-test-secret-with-at-least-32-characters";
const now = Date.parse("2026-09-23T12:00:00.000Z");
const userId = "00000000-0000-4000-8000-000000000001";

test("accepts an unexpired recovery grant only for the same user", async () => {
  const grant = createPasswordRecoveryGrant(userId, secret, now);

  expect(verifyPasswordRecoveryGrant(grant, userId, secret, now + 60_000)).toBe(true);
  expect(
    verifyPasswordRecoveryGrant(grant, "00000000-0000-4000-8000-000000000002", secret, now),
  ).toBe(false);
});

test("rejects expired or tampered recovery grants", () => {
  const grant = createPasswordRecoveryGrant(userId, secret, now);

  expect(verifyPasswordRecoveryGrant(grant, userId, secret, now + 16 * 60_000)).toBe(false);
  expect(verifyPasswordRecoveryGrant(`${grant}x`, userId, secret, now)).toBe(false);
});
