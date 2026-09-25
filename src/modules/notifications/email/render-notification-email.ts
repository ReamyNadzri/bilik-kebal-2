import type { NotificationKind } from "@/contracts/notifications";
import { renderEmail } from "./email-layout";
import { notificationEmailCopy, type NotificationEmailContext } from "./notification-email-content";

export type { NotificationEmailContext } from "./notification-email-content";

export function renderNotificationEmail(
  kind: NotificationKind,
  context: NotificationEmailContext,
  appUrl: string,
): { subject: string; html: string; text: string } {
  const origin = appUrl.replace(/\/+$/, "");
  const copy = notificationEmailCopy(kind, context);
  const rendered = renderEmail(
    {
      subject: copy.subject,
      preview: copy.paragraphs[0] ?? copy.heading,
      heading: copy.heading,
      paragraphs: copy.paragraphs,
      action: { label: copy.action.label, href: `${origin}${copy.action.path}` },
    },
    origin,
  );
  return { subject: copy.subject, ...rendered };
}
