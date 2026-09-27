/**
 * Where each poster sits on the Hunters wall, and how it moves.
 *
 * Pure arithmetic, so the layout is the same on the server and in the browser
 * and can be tested without a DOM. Every per-poster variation comes from a
 * stable key derived from the member's public id: a poster keeps its tilt,
 * crease and pin from one visit to the next.
 */

export type WallPhase = "pre" | "in" | "out";

export interface WallCell {
  /** 1-based grid column and row. */
  readonly column: number;
  readonly row: number;
  /** Offset from the board's centre, in cells. */
  readonly vx: number;
  readonly vy: number;
}

/** Posters per row: fewer on narrow screens, never more than there are posters. */
export function wallColumns(count: number, viewportWidth: number): number {
  const fit = viewportWidth < 560 ? 2 : viewportWidth < 820 ? 3 : viewportWidth < 1120 ? 4 : 5;
  return Math.max(1, Math.min(count, fit));
}

/**
 * Grid cells nearest the centre first, rows weighted 1.4 so the wall grows
 * wider before it grows taller. Poster i takes the i-th cell, so the first
 * posters sit in the middle and any empty cells fall on the corners. Ties
 * resolve left to right, top to bottom.
 */
export function centreOutCells(count: number, columns: number): WallCell[] {
  if (count <= 0) return [];
  const rows = Math.ceil(count / columns);
  const cc = (columns - 1) / 2;
  const cr = (rows - 1) / 2;
  const cells: Array<WallCell & { distance: number }> = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      cells.push({
        column: c + 1,
        row: r + 1,
        vx: c - cc,
        vy: r - cr,
        distance: (c - cc) ** 2 + ((r - cr) * 1.4) ** 2 + c * 0.001 + r * 0.0001,
      });
    }
  }
  return cells
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map(({ column, row, vx, vy }) => ({ column, row, vx, vy }));
}

/** A small positive integer from a public id (FNV-1a), stable across renders. */
export function posterKey(publicId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < publicId.length; index += 1) {
    hash ^= publicId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash % 997) + 1;
}

export interface PosterLook {
  /** Resting tilt in degrees. */
  readonly rotate: number;
  /** Resting nudge in pixels; zero on a flat grid. */
  readonly dx: number;
  readonly dy: number;
  readonly creaseAngle: number;
  readonly stainX: number;
  readonly stainY: number;
  /** Two posters in three are pinned; every third is taped. */
  readonly fixing: "pin" | "tape";
}

/** The aged-paper variation of one poster. `flat` barely tilts and never shifts. */
export function posterLook(key: number, flat = false): PosterLook {
  return {
    rotate: (((key * 37) % 11) - 5) * (flat ? 0.4 : 0.9),
    dx: flat ? 0 : ((key * 13) % 9) - 4,
    dy: flat ? 0 : ((key * 29) % 13) - 6,
    creaseAngle: 100 + ((key * 23) % 70),
    stainX: (key * 17) % 100,
    stainY: (key * 41) % 100,
    fixing: key % 3 === 0 ? "tape" : "pin",
  };
}

/** Stacking: the centre on top, with a little jitter so overlaps look pinned by hand. */
export function wallZIndex(index: number, key: number): number {
  return 40 - index + ((key * 7) % 3);
}

export interface PosterMotion {
  readonly transform: string;
  readonly opacity: number;
  readonly transition: string;
}

/**
 * One poster's transform in each phase.
 *
 * pre: collapsed toward the board's centre, invisible, no transition.
 * in: to rest, staggered from the centre outward.
 * out: flung off the board, the outer edge leaving first.
 */
export function posterMotion(
  phase: WallPhase,
  options: { index: number; count: number; key: number; cell: WallCell; look: PosterLook },
): PosterMotion {
  const { index, count, key, cell, look } = options;
  const rest = `translate(${look.dx}px, ${look.dy}px) rotate(${look.rotate}deg)`;
  if (phase === "pre") {
    return {
      transform: `translate(${-cell.vx * 100}%, ${-cell.vy * 110}%) scale(0.35) rotate(${look.rotate * 3}deg)`,
      opacity: 0,
      transition: "none",
    };
  }
  if (phase === "out") {
    const direction = key % 2 ? 1 : -1;
    const ox = (cell.vx || direction * 0.6) * 380 + direction * 80;
    const oy = (cell.vy || -0.4) * 300 - 220;
    const delay = (count - 1 - index) * 22;
    return {
      transform: `translate(${ox}px, ${oy}px) rotate(${direction * (35 + ((key * 7) % 60))}deg)`,
      opacity: 0,
      transition: `transform 540ms cubic-bezier(0.5, 0, 0.9, 0.4) ${delay}ms, opacity 540ms ease-in ${delay}ms`,
    };
  }
  const delay = index * 55;
  return {
    transform: rest,
    opacity: 1,
    transition: `transform 560ms cubic-bezier(0.2, 0.9, 0.3, 1.15) ${delay}ms, opacity 220ms ${delay}ms`,
  };
}

/** How long the out phase takes for a page of this size, before the next page grows. */
export function flipOutDuration(pageSize: number): number {
  return 560 + pageSize * 22;
}
