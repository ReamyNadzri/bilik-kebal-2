import { emailTheme } from "./email-theme";

const { color, font } = emailTheme;

export const EMAIL_FOOTER_SPAM_HINT =
  "Found this in Spam? Mark it Not spam so our updates reach you.";

/** Everything an email says. HTML and plain text are both derived from it. */
export interface EmailContent {
  subject: string;
  preview: string;
  heading: string;
  paragraphs: readonly string[];
  action: { label: string; href: string };
  code?: { lead: string; value: string };
}

/** Every interpolated value, in text and in attributes, goes through this. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const style = (rules: Record<string, string | number>) =>
  Object.entries(rules)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value}`)
    .join(";");

const bodyText = style({
  fontFamily: font.body,
  fontSize: "16px",
  lineHeight: "24px",
  color: color.textPrimary,
  margin: "0 0 12px",
});
const smallText = (textColor: string, margin = "0 0 4px") =>
  style({ fontFamily: font.body, fontSize: "13px", lineHeight: "20px", color: textColor, margin });

function renderHtml(content: EmailContent, appUrl: string): string {
  const e = escapeHtml;
  const host = appUrl.replace(/^https?:\/\//, "");
  const paragraphs = content.paragraphs.map((p) => `<p style="${bodyText}">${e(p)}</p>`).join("");
  const code = content.code
    ? `<p style="${bodyText}">${e(content.code.lead)} <strong style="${style({ fontSize: "20px", letterSpacing: "4px" })}">${e(content.code.value)}</strong></p>`
    : "";

  return `<!DOCTYPE html><html lang="en"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="color-scheme" content="light only"/><title>${e(content.subject)}</title></head><body style="${style({ margin: 0, padding: 0, backgroundColor: color.pageBackground })}"><div style="display:none;max-height:0;overflow:hidden">${e(content.preview)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${style({ backgroundColor: color.pageBackground, padding: "24px 0" })}"><tbody><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tbody><tr><td align="center" style="${style({ backgroundColor: color.headerBackground, padding: "20px 24px" })}"><img src="${e(`${appUrl}/brand/email/logo.png`)}" alt="VAULTIX" width="96" height="93" style="display:block;border:0"/></td></tr><tr><td style="${style({ backgroundColor: color.cardBackground, padding: "28px 24px", borderTop: `4px solid ${color.brass}`, borderBottom: `4px solid ${color.brass}` })}"><h1 style="${style({ fontFamily: font.heading, fontSize: "24px", lineHeight: "32px", fontWeight: 400, color: color.textPrimary, margin: "0 0 16px" })}">${e(content.heading)}</h1>${paragraphs}${code}<table role="presentation" cellpadding="0" cellspacing="0"><tbody><tr><td style="${style({ backgroundColor: color.accent, padding: "12px 20px" })}"><a class="email-button" href="${e(content.action.href)}" style="${style({ fontFamily: font.body, fontSize: "16px", fontWeight: 700, color: color.textOnAccent, textDecoration: "none" })}">${e(content.action.label)}</a></td></tr></tbody></table><p style="${smallText(color.textMuted, "16px 0 0")};word-break:break-all">If the button does not work, open this link: <a href="${e(content.action.href)}" style="color:${color.accent}">${e(content.action.href)}</a></p></td></tr><tr><td align="center" style="padding:16px 24px"><p style="${smallText(color.textOnDark)}">${e(EMAIL_FOOTER_SPAM_HINT)}</p><p style="${smallText(color.textOnDark, "0")}">VAULTIX · <a href="${e(appUrl)}" style="color:${color.textOnDark}">${e(host)}</a></p></td></tr></tbody></table></td></tr></tbody></table></body></html>`;
}

function renderText(content: EmailContent, appUrl: string): string {
  return [
    content.heading,
    ...content.paragraphs,
    ...(content.code ? [`${content.code.lead} ${content.code.value}`] : []),
    `${content.action.label}: ${content.action.href}`,
    "--",
    EMAIL_FOOTER_SPAM_HINT,
    `VAULTIX · ${appUrl}`,
  ].join("\n\n");
}

/**
 * Table layout with inline styles: the form Gmail, Outlook and Apple Mail all
 * render. Built as a string because Next.js forbids react-dom/server in App
 * Routes, and the dispatcher runs in one.
 */
export function renderEmail(content: EmailContent, appUrl: string): { html: string; text: string } {
  const origin = appUrl.replace(/\/+$/, "");
  return { html: renderHtml(content, origin), text: renderText(content, origin) };
}
