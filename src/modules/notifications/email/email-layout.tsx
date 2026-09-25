import type { CSSProperties } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

const text: CSSProperties = {
  fontFamily: font.body,
  fontSize: 16,
  lineHeight: "24px",
  color: color.textPrimary,
  margin: "0 0 12px",
};
const small: CSSProperties = { ...text, fontSize: 13, lineHeight: "20px", margin: "0 0 4px" };

function EmailDocument({ content, appUrl }: { content: EmailContent; appUrl: string }) {
  const host = appUrl.replace(/^https?:\/\//, "");
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light only" />
        <title>{content.subject}</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: color.pageBackground }}>
        {/* Inbox preview line; hidden in the message itself. */}
        <div style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>{content.preview}</div>
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ backgroundColor: color.pageBackground, padding: "24px 0" }}
        >
          <tbody>
            <tr>
              <td align="center">
                <table
                  role="presentation"
                  width="100%"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{ maxWidth: 560 }}
                >
                  <tbody>
                    <tr>
                      <td
                        align="center"
                        style={{ backgroundColor: color.headerBackground, padding: "20px 24px" }}
                      >
                        <img
                          src={`${appUrl}/brand/email/logo.png`}
                          alt="VAULTIX"
                          width={96}
                          height={96}
                          style={{ display: "block", border: 0 }}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          backgroundColor: color.cardBackground,
                          padding: "28px 24px",
                          borderTop: `4px solid ${color.brass}`,
                          borderBottom: `4px solid ${color.brass}`,
                        }}
                      >
                        <h1
                          style={{
                            fontFamily: font.heading,
                            fontSize: 24,
                            lineHeight: "32px",
                            fontWeight: 400,
                            color: color.textPrimary,
                            margin: "0 0 16px",
                          }}
                        >
                          {content.heading}
                        </h1>
                        {content.paragraphs.map((paragraph) => (
                          <p key={paragraph} style={text}>
                            {paragraph}
                          </p>
                        ))}
                        {content.code ? (
                          <p style={text}>
                            {content.code.lead}{" "}
                            <strong style={{ fontSize: 20, letterSpacing: 4 }}>
                              {content.code.value}
                            </strong>
                          </p>
                        ) : null}
                        <table role="presentation" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td style={{ backgroundColor: color.accent, padding: "12px 20px" }}>
                                <a
                                  className="email-button"
                                  href={content.action.href}
                                  style={{
                                    fontFamily: font.body,
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: color.textOnAccent,
                                    textDecoration: "none",
                                  }}
                                >
                                  {content.action.label}
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p
                          style={{
                            ...small,
                            color: color.textMuted,
                            margin: "16px 0 0",
                            wordBreak: "break-all",
                          }}
                        >
                          If the button does not work, open this link:{" "}
                          <a href={content.action.href} style={{ color: color.accent }}>
                            {content.action.href}
                          </a>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style={{ padding: "16px 24px" }}>
                        <p style={{ ...small, color: color.textOnDark }}>
                          {EMAIL_FOOTER_SPAM_HINT}
                        </p>
                        <p style={{ ...small, color: color.textOnDark, margin: 0 }}>
                          VAULTIX ·{" "}
                          <a href={appUrl} style={{ color: color.textOnDark }}>
                            {host}
                          </a>
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
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
 * Table layout with inline styles: the only form Gmail, Outlook and Apple Mail
 * all render. React escapes every interpolated value.
 */
export function renderEmail(content: EmailContent, appUrl: string): { html: string; text: string } {
  const origin = appUrl.replace(/\/+$/, "");
  return {
    html: `<!DOCTYPE html>${renderToStaticMarkup(<EmailDocument content={content} appUrl={origin} />)}`,
    text: renderText(content, origin),
  };
}
