// @vitest-environment node
import { expect, test } from "vitest";
import { escapeHtml, renderEmail } from "./email-layout";

test("escapes every character that could break out of text or an attribute", () => {
  expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
    "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
  );
});

test("a hostile value cannot add markup or attributes", () => {
  const { html } = renderEmail(
    {
      subject: "S",
      preview: "P",
      heading: '"><img src=x onerror=alert(1)>',
      paragraphs: ["</p><script>alert(1)</script>"],
      action: { label: "Go", href: 'https://example.test/" onmouseover="x' },
    },
    "https://example.test",
  );
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img src=x");
  expect(html).not.toContain('" onmouseover="');
});
