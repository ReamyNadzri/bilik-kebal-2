/**
 * Relative time at the presentation edge.
 *
 * Instants are UTC and arrive as ISO strings (`context/code-standards.md`).
 * Every function takes the reference instant as an argument rather than
 * reading the clock: a component that calls `Date.now()` renders one string on
 * the server and a different one in the browser, which is a hydration mismatch
 * on a page that shows deadlines and money.
 *
 * While the marketplace is fixture-backed the caller passes `FIXTURE_NOW`, so
 * the same words appear on every render and in every test. When Codex supplies
 * real Wanted reads the caller passes the server-rendered request instant
 * instead; no signature changes.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function elapsed(instant: string, now: string): number {
  return Date.parse(now) - Date.parse(instant);
}

function describeAge(instant: string, now: string): string {
  const age = elapsed(instant, now);

  if (age < MINUTE) {
    return "just now";
  }

  if (age < HOUR) {
    return `${plural(Math.floor(age / MINUTE), "minute")} ago`;
  }

  if (age < DAY) {
    return `${plural(Math.floor(age / HOUR), "hour")} ago`;
  }

  return `${plural(Math.floor(age / DAY), "day")} ago`;
}

/** "Posted 3 days ago" — how long a Wanted has been on the Board. */
export function formatPostedAge(postedAt: string, now: string): string {
  return `Posted ${describeAge(postedAt, now)}`;
}

/** "3 days old" — the poster's compact age, set beside the backer count. */
export function formatAgeOld(postedAt: string, now: string): string {
  const age = elapsed(postedAt, now);

  if (age < DAY) {
    return "New today";
  }

  return `${plural(Math.floor(age / DAY), "day")} old`;
}

/** "Submitted 3 days ago" — when the viewer sent their own claim. */
export function formatSubmittedAge(submittedAt: string, now: string): string {
  return `Submitted ${describeAge(submittedAt, now)}`;
}

export interface ClosingTime {
  readonly label: string;
  /**
   * Under a day. Presentation uses this to add a second signal beside the
   * words — never to replace them, and never as colour alone.
   */
  readonly urgent: boolean;
}

export interface FormatClosingOptions {
  /** The detail page has room for two units; a card has room for one. */
  readonly detail?: boolean;
  /** `left` reads "11 days left", the poster's wording; `closes` reads "Closes in 11 days". */
  readonly phrasing?: "closes" | "left";
}

/**
 * "Closes in 6 hours" on a card, "2 days 15 hours left" on the detail page.
 *
 * A deadline that has passed reports "Closed" rather than counting backwards:
 * a bounty past its close is a lifecycle change, not a negative duration.
 */
export function formatClosing(
  closesAt: string,
  now: string,
  options: FormatClosingOptions = {},
): ClosingTime {
  const remaining = Date.parse(closesAt) - Date.parse(now);

  if (remaining <= 0) {
    return { label: "Closed", urgent: false };
  }

  const urgent = remaining < DAY;

  if (options.detail === true) {
    if (remaining >= DAY) {
      const days = Math.floor(remaining / DAY);
      const hours = Math.floor((remaining % DAY) / HOUR);

      return { label: `${plural(days, "day")} ${plural(hours, "hour")} left`, urgent };
    }

    const hours = Math.floor(remaining / HOUR);
    const minutes = Math.floor((remaining % HOUR) / MINUTE);

    return { label: `${plural(hours, "hour")} ${plural(minutes, "minute")} left`, urgent };
  }

  const phrase = (amount: string) =>
    options.phrasing === "left" ? `${amount} left` : `Closes in ${amount}`;

  if (remaining >= DAY) {
    return { label: phrase(plural(Math.floor(remaining / DAY), "day")), urgent };
  }

  if (remaining >= HOUR) {
    return { label: phrase(plural(Math.floor(remaining / HOUR), "hour")), urgent };
  }

  return {
    label: phrase(plural(Math.max(1, Math.floor(remaining / MINUTE)), "minute")),
    urgent,
  };
}

const JOINED = new Intl.DateTimeFormat("en-MY", {
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kuala_Lumpur",
});

/** "September 2026" — when a member joined, fixed to Malaysian time. */
export function formatJoined(instant: string): string {
  return JOINED.format(new Date(instant));
}
