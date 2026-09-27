import type { WantedDetail } from "@/features/marketplace/types";
import { formatRinggit } from "@/features/marketplace/money";

/**
 * What a shared Wanted says, in the picture and in the chat caption.
 *
 * Only what the public detail already shows anyone signed in: title, course,
 * campus and bounty. Never the poster's name, a claim, or anything a Hunter
 * supplied. The link opens the Wanted, which still asks for a verified email
 * before it shows the request.
 */
export interface ShareWantedContent {
  readonly heading: string;
  readonly code: string;
  readonly subject: string;
  readonly title: string;
  readonly rewardLabel: string;
  readonly reward: string;
  readonly caption: string;
  readonly url: string;
}

export function shareWantedContent(wanted: WantedDetail, origin: string): ShareWantedContent {
  const academic = wanted.kind === "academic";
  const paid = !wanted.isFree && wanted.grossBountySen > 0;
  const code = academic ? wanted.courseCode : wanted.resourceType;
  const subject = academic ? `${wanted.courseName} · ${wanted.campus}` : wanted.campus;
  const reward = paid ? formatRinggit(wanted.grossBountySen) : "Free request";
  const url = `${origin.replace(/\/$/, "")}/wanted/${encodeURIComponent(wanted.id)}`;
  const place = academic ? `${wanted.courseCode} ${wanted.courseName}` : wanted.resourceType;

  return {
    heading: "WANTED",
    code,
    subject,
    title: wanted.title,
    rewardLabel: paid ? "REWARD" : "NO BOUNTY",
    reward,
    caption: [
      `WANTED: ${wanted.title}`,
      `${place} · ${wanted.campus}`,
      paid ? `Reward: ${reward}` : "Free request, no bounty",
      `Can you help? ${url}`,
    ].join("\n"),
    url,
  };
}

/** Chat links that open WhatsApp or Telegram with the caption filled in. */
export function chatShareUrl(target: "whatsapp" | "telegram", content: ShareWantedContent): string {
  if (target === "whatsapp") return `https://wa.me/?text=${encodeURIComponent(content.caption)}`;
  const text = content.caption.replace(`\n${`Can you help? ${content.url}`}`, "\nCan you help?");
  return `https://t.me/share/url?url=${encodeURIComponent(content.url)}&text=${encodeURIComponent(text)}`;
}

/* -------------------------------------------------------------------------- */
/* Poster picture                                                              */
/* -------------------------------------------------------------------------- */

const WIDTH = 1080;
const HEIGHT = 1350;

/**
 * The tokens the picture is drawn with, read from the page so the designer's
 * handoff restyles the shared picture along with the site.
 */
function tokens() {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    paper: read("--bg-poster", "Canvas"),
    ink: read("--text-poster", "CanvasText"),
    heading: read("--text-poster-heading", "CanvasText"),
    portrait: read("--accent-ink", "CanvasText"),
    portraitText: read("--accent-ink-text", "Canvas"),
    rule: read("--border-strong", "CanvasText"),
    softRule: read("--border-poster-rule", "GrayText"),
    money: read("--money-ink", "CanvasText"),
    display: read("--font-display", "serif"),
    body: read("--font-ui", "sans-serif"),
  };
}

function wrap(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/\s+\S*$/, "")}…`;
  return kept;
}

/**
 * Draws the shareable poster: the same WANTED sheet the dialog shows, with
 * no stamp. Returns null where the browser cannot draw or encode it, and the
 * caller shares the caption alone.
 */
export async function renderSharePoster(content: ShareWantedContent): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext("2d");
  } catch {
    return null;
  }
  if (!context) return null;

  try {
    await document.fonts?.ready;
  } catch {
    // Fall back to whatever fonts are ready; the text is still legible.
  }

  const t = tokens();
  const pad = 80;
  const inner = WIDTH - pad * 2;

  context.fillStyle = t.paper;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.strokeStyle = t.rule;
  context.lineWidth = 6;
  context.strokeRect(24, 24, WIDTH - 48, HEIGHT - 48);

  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillStyle = t.heading;
  context.font = `190px ${t.display}`;
  context.fillText(content.heading, WIDTH / 2, 250);

  context.fillStyle = t.rule;
  context.fillRect(pad, 290, inner, 5);
  context.fillRect(pad, 303, inner, 5);

  // Portrait box: course code (or kind) and subject.
  const boxTop = 350;
  const boxHeight = 300;
  context.fillStyle = t.portrait;
  context.fillRect(pad, boxTop, inner, boxHeight);
  context.fillStyle = t.portraitText;
  context.font = `${content.code.length > 10 ? 90 : 130}px ${t.display}`;
  context.fillText(content.code, WIDTH / 2, boxTop + 170, inner - 40);
  context.font = `600 38px ${t.body}`;
  const subject = wrap(context, content.subject, inner - 60, 2);
  subject.forEach((line, index) =>
    context.fillText(line, WIDTH / 2, boxTop + 235 + index * 44, inner - 40),
  );

  context.fillStyle = t.heading;
  context.font = `56px ${t.display}`;
  const title = wrap(context, content.title, inner, 3);
  title.forEach((line, index) => context.fillText(line, WIDTH / 2, 750 + index * 70));

  const rewardTop = 750 + title.length * 70 + 20;
  context.fillStyle = t.softRule;
  context.fillRect(pad, rewardTop, inner, 4);
  context.fillStyle = t.ink;
  context.font = `700 34px ${t.body}`;
  context.fillText(content.rewardLabel, WIDTH / 2, rewardTop + 70);
  context.fillStyle = t.money;
  context.font = `800 ${content.reward.length > 10 ? 96 : 120}px ${t.body}`;
  context.fillText(content.reward, WIDTH / 2, rewardTop + 190, inner);
  context.fillStyle = t.softRule;
  context.fillRect(pad, rewardTop + 230, inner, 4);

  context.fillStyle = t.ink;
  context.font = `700 40px ${t.body}`;
  context.fillText("VAULTIX", WIDTH / 2, HEIGHT - 110);
  context.font = `30px ${t.body}`;
  context.fillText(content.url.replace(/^https?:\/\//, ""), WIDTH / 2, HEIGHT - 65, inner);

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      resolve(null);
    }
  });
}
