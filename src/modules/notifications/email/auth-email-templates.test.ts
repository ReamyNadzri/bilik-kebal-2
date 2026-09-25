// @vitest-environment node
import { expect, test } from "vitest";
import { renderAuthEmailTemplate } from "./auth-email-templates";

test("confirmation template targets the scanner-safe confirm page", async () => {
  const html = renderAuthEmailTemplate("confirmation");
  expect(html).toContain(
    'href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email"',
  );
  expect(html).toContain("{{ .SiteURL }}/brand/email/logo.png");
  expect(html).toContain("Mark it Not spam");
  expect(html).not.toContain("{{ .ConfirmationURL }}");
  await expect(html).toMatchFileSnapshot("../../../../supabase/templates/confirmation.html");
});

test("recovery template has the link and the 6-digit code fallback", async () => {
  const html = renderAuthEmailTemplate("recovery");
  expect(html).toContain(
    'href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery"',
  );
  expect(html).toContain("{{ .Token }}");
  expect(html).not.toContain("{{ .ConfirmationURL }}");
  await expect(html).toMatchFileSnapshot("../../../../supabase/templates/recovery.html");
});
