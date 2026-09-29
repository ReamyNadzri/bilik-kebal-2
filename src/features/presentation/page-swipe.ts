/**
 * Swiping sideways between the main pages on a phone
 * (design_handoff_vaultix_mobile, §4b).
 *
 * Presentation only: which page is next, and whether a finished touch counts
 * as a swipe. The shell wires it to touch events.
 */

/** Left to right, as the tab bar reads. Hunt is the claims route. */
export const PAGE_SWIPE_ORDER: readonly string[] = ["/", "/board", "/map", "/claims", "/archive"];

const MIN_DISTANCE_PX = 70;
const MAX_SLOPE = 0.5;
const MAX_DURATION_MS = 700;

export interface TouchStroke {
  readonly dx: number;
  readonly dy: number;
  readonly ms: number;
}

/**
 * Where a finished touch leads, or null when it is not a page swipe.
 *
 * A swipe travels at least 70 px sideways, at most half as far vertically, in
 * 700 ms or less. Swiping left moves to the next page and swiping right to the
 * previous one; either end of the order is a wall. Only the pages themselves
 * take part, not the screens beneath them.
 */
export function swipeDestination(pathname: string, stroke: TouchStroke): string | null {
  const { dx, dy, ms } = stroke;
  if (ms > MAX_DURATION_MS) return null;
  if (Math.abs(dx) < MIN_DISTANCE_PX) return null;
  if (Math.abs(dy) > Math.abs(dx) * MAX_SLOPE) return null;

  const index = PAGE_SWIPE_ORDER.indexOf(pathname);
  if (index < 0) return null;
  return PAGE_SWIPE_ORDER[index + (dx < 0 ? 1 : -1)] ?? null;
}

/**
 * Whether a touch began somewhere a sideways stroke already means something
 * else: in a text field or a select, or inside something that scrolls
 * sideways and actually overflows, such as a poster rail.
 */
export function touchBelongsElsewhere(start: EventTarget | null): boolean {
  for (
    let node = start instanceof Element ? start : null;
    node !== null && node !== document.body;
    node = node.parentElement
  ) {
    if (node.matches("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) {
      return true;
    }
    const { overflowX } = getComputedStyle(node);
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth + 2
    ) {
      return true;
    }
  }
  return false;
}

/** Whether a modal dialog is open over the page. */
export function modalIsOpen(): boolean {
  return document.querySelector('[aria-modal="true"], dialog[open]') !== null;
}
