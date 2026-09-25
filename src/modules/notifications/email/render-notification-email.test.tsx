// @vitest-environment node
import { describe, expect, test } from "vitest";
import { notificationKinds } from "@/contracts/notifications";
import { renderNotificationEmail } from "./render-notification-email";

const APP = "https://bilikkebal.afes.my";
const FORBIDDEN = [/evidence/i, /object_key/i, /storage/i, /bucket/i, /quarantine/i];

describe.each(notificationKinds.filter((kind) => kind !== "wanted_reply"))("%s", (kind) => {
  test("renders branded HTML with a text alternative and the action URL", () => {
    const email = renderNotificationEmail(kind, {}, APP);
    expect(email.subject.length).toBeGreaterThan(5);
    expect(email.html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(email.html).toContain('<html lang="en"');
    expect(email.html).toContain(`${APP}/brand/email/logo.png`);
    expect(email.html).toContain('alt="VAULTIX"');
    expect(email.html).toContain("Mark it Not spam");
    expect(email.text).toContain("Mark it Not spam");
    const action =
      /class="email-button"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*class="email-button"/.exec(
        email.html,
      );
    const href = (action?.[1] ?? action?.[2])?.replace(/&amp;/g, "&");
    expect(href?.startsWith(`${APP}/`)).toBe(true);
    expect(email.text).toContain(href!);
    for (const pattern of FORBIDDEN) {
      expect(email.html).not.toMatch(pattern);
      expect(email.text).not.toMatch(pattern);
    }
  });
});

test("Sheriff alert names the requester and institution, escaped", () => {
  const email = renderNotificationEmail(
    "institution_verification_submitted",
    { requesterDisplayName: "Aina <script>", institutionName: "UiTM Shah Alam" },
    APP,
  );
  expect(email.subject).toBe("New institution verification request");
  expect(email.html).toContain("Aina &lt;script&gt;");
  expect(email.html).not.toContain("<script>");
  expect(email.text).toContain("UiTM Shah Alam");
  expect(email.html).toContain(`${APP}/console`);
});

test("Sheriff alert falls back to neutral wording without context", () => {
  const email = renderNotificationEmail("institution_verification_submitted", {}, APP);
  expect(email.text).toContain("from a member is waiting");
});

test("welcome email offers WELCOME with the live credit count", () => {
  const email = renderNotificationEmail("welcome", { welcomeCodeCredits: 2 }, APP);
  expect(email.subject).toBe("Welcome to VAULTIX");
  expect(email.text).toContain("Redeem code WELCOME on your profile for 2 free requests.");
  expect(email.html).toContain(`${APP}/profile`);
});

test("welcome email says request (singular) for one credit", () => {
  const email = renderNotificationEmail("welcome", { welcomeCodeCredits: 1 }, APP);
  expect(email.text).toContain("for 1 free request.");
});

test("welcome email omits the code when it cannot be redeemed", () => {
  const email = renderNotificationEmail("welcome", {}, APP);
  expect(email.text).not.toContain("WELCOME on your profile");
  expect(email.text).toContain("Your email is verified.");
});

test("a trailing slash on the app URL does not double up", () => {
  const email = renderNotificationEmail("claim_approved", {}, `${APP}/`);
  expect(email.html).not.toContain("my//");
});
