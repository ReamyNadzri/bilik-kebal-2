import type { Sen } from "@/contracts/marketplace";

/**
 * Money at the presentation edge.
 *
 * `context/architecture.md` makes integer sen an invariant: floating point is
 * forbidden for financial values, and money is branded at the type level. This
 * module is where that rule meets presentation.
 *
 * `Sen` is now the contract's branded money type, re-exported so presentation
 * code keeps one import for money while the brand itself lives with the
 * operations that produce it. A value from the marketplace contract and a
 * value built here are the same type, so neither needs casting into the other.
 *
 * No component performs arithmetic on money. Values arrive as sen and are
 * formatted exactly once, here.
 */

/** A whole number of sen. 100 sen is RM 1. Owned by `src/contracts/`. */
export type { Sen };

/**
 * Narrows an integer to `Sen`, refusing anything that could only have come
 * from floating-point arithmetic on money.
 */
export function sen(value: number): Sen {
  if (!Number.isInteger(value)) {
    throw new TypeError(`Money must be an integer number of sen, received ${value}`);
  }

  if (value < 0) {
    throw new RangeError(`Money must not be negative, received ${value}`);
  }

  return value as Sen;
}

/** Authoring helper for fixtures written in whole Ringgit. */
export function toSen(ringgit: number): Sen {
  return sen(Math.round(ringgit * 100));
}

export interface FormatRinggitOptions {
  /**
   * `omit` returns the amount alone so a caller can set the "RM" unit in its
   * own element — the bounty plate stacks them. The accessible name is then
   * the caller's responsibility.
   */
  readonly unit?: "include" | "omit";
}

const GROUPED = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const GROUPED_WITH_CENTS = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Renders sen as Malaysian Ringgit.
 *
 * A whole Ringgit amount drops the `.00` tail. Bounties are whole Ringgit by
 * construction — every contribution is RM1 to RM50 — so carrying two zeros on
 * every card would be noise, while a part-Ringgit total (a fee line, a net
 * payout) still shows its sen.
 */
export function formatRinggit(amount: Sen, options: FormatRinggitOptions = {}): string {
  const whole = amount % 100 === 0;
  const digits = whole ? GROUPED.format(amount / 100) : GROUPED_WITH_CENTS.format(amount / 100);

  return options.unit === "omit" ? digits : `RM ${digits}`;
}
