/**
 * The Duel's pixel art, drawn on canvas: the two gunslingers, their hats and
 * revolvers, muzzle flash, dust, blood, and the pixelated faces.
 *
 * Ported from the designer's prototype (design_handoff_vaultix_duel,
 * `Vaultix Duel.dc.html`): the shapes, palette and maths are the handoff's,
 * high fidelity. Characters are drawn with vector paths and flattened to
 * pixels by `flattenLayer` afterwards.
 *
 * Canvas cannot read CSS custom properties cheaply every frame, so the
 * palette lives here as the handoff's literal colours, scoped to this game.
 */

/** The logical canvas: 256 × 144, drawn at 2× and scaled up with hard edges. */
export const W = 256;
export const H = 144;
/** Ordered-dither threshold matrix, 4 × 4. */
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
export const INK = "#1a0f08";

export type Pt = readonly [number, number];

export interface Palette {
  readonly coat: string;
  readonly coatD: string;
  readonly vest: string;
  readonly shirt: string;
  readonly trou: string;
  readonly boot: string;
  readonly hat: string;
  readonly hatD: string;
  readonly band: string;
  readonly glove: string;
}

/** The player wears a red vest; the opponent a green vest, black hat and gold band. */
export const COL: { readonly me: Palette; readonly opp: Palette } = {
  me: {
    coat: "#5a3a22",
    coatD: "#3e2716",
    vest: "#9e2b25",
    shirt: "#e8dcc0",
    trou: "#3d3a4a",
    boot: "#2a170c",
    hat: "#8a5a2e",
    hatD: "#5e3a1a",
    band: "#9e2b25",
    glove: "#4a2814",
  },
  opp: {
    coat: "#2e2a28",
    coatD: "#1e1a18",
    vest: "#1f4d34",
    shirt: "#d8d0bc",
    trou: "#4a4038",
    boot: "#1a120c",
    hat: "#24201c",
    hatD: "#141210",
    band: "#c89b3c",
    glove: "#2a1a10",
  },
};

/** Where the two stand in the over-the-shoulder scene. */
export const OTS = { opp: { x: 150, y: 106, sc: 0.62 }, me: { x: 64, y: 182, sc: 2.5 } } as const;

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);
/** A stable pseudo-random number in [0, 1) for an integer seed. */
export const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** A colour lightened (k > 0) or darkened (k < 0). */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

type Ctx = CanvasRenderingContext2D;

function gradient(
  x: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  col: string,
  a = 0.2,
  b = -0.32,
): CanvasGradient {
  const g = x.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(col, a));
  g.addColorStop(1, shade(col, b));
  return g;
}

/** Fills an SVG path, outlined in ink unless `lineWidth` is 0. */
function fillPath(x: Ctx, d: string, fill: string | CanvasGradient, lineWidth?: number): Path2D {
  const p = new Path2D(d);
  x.fillStyle = fill;
  x.fill(p);
  if (lineWidth !== 0) {
    x.strokeStyle = INK;
    x.lineWidth = lineWidth ?? 0.55;
    x.lineJoin = "round";
    x.stroke(p);
  }
  return p;
}

function arm(
  x: Ctx,
  s0: Pt,
  e0: Pt,
  h0: Pt,
  wU: number,
  wF: number,
  col: string,
  cuff: string,
  glove: string,
  thumbDir: number,
) {
  const seg = (a: Pt, b: Pt, w0: number, w1: number) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    return `M${a[0] + nx * w0} ${a[1] + ny * w0} L${b[0] + nx * w1} ${b[1] + ny * w1} L${b[0] - nx * w1} ${b[1] - ny * w1} L${a[0] - nx * w0} ${a[1] - ny * w0} Z`;
  };
  fillPath(x, seg(s0, e0, wU, wU * 0.85), gradient(x, s0[0] - 3, s0[1], s0[0] + 3, s0[1], col));
  x.beginPath();
  x.arc(e0[0], e0[1], wU * 0.85, 0, 7);
  x.fillStyle = shade(col, -0.1);
  x.fill();
  fillPath(x, seg(e0, h0, wF, wF * 0.8), gradient(x, e0[0] - 3, e0[1], e0[0] + 3, e0[1], col));
  const dx = h0[0] - e0[0];
  const dy = h0[1] - e0[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const c0: Pt = [h0[0] - ux * 1.2, h0[1] - uy * 1.2];
  fillPath(x, seg(c0, h0, wF * 1.05, wF * 1.05), cuff, 0.45);
  x.beginPath();
  x.ellipse(h0[0] + ux * 1.1, h0[1] + uy * 1.1, 1.55, 1.25, Math.atan2(uy, ux), 0, 7);
  x.fillStyle = gradient(x, h0[0] - 1.5, h0[1] - 1.5, h0[0] + 1.5, h0[1] + 1.5, glove);
  x.fill();
  x.strokeStyle = INK;
  x.lineWidth = 0.45;
  x.stroke();
  x.beginPath();
  x.ellipse(
    h0[0] + ux * 0.6 - uy * thumbDir,
    h0[1] + uy * 0.6 + ux * thumbDir,
    0.55,
    0.9,
    Math.atan2(uy, ux),
    0,
    7,
  );
  x.fillStyle = shade(glove, 0.1);
  x.fill();
  x.stroke();
}

/** A revolver in profile, muzzle at `len` along +x. */
export function revolverSide(x: Ctx, len: number) {
  fillPath(
    x,
    `M-.4 -1.35 L${len} -1.35 L${len} .05 L-.4 .05 Z`,
    gradient(x, 0, -1.4, 0, 0.1, "#9aa2a8", 0.35, -0.35),
    0.45,
  );
  fillPath(
    x,
    "M-.3 -2 L3.2 -2 Q3.6 -.6 3.2 .8 L-.3 .8 Z",
    gradient(x, 0, -2, 0, 0.8, "#5a6168", 0.3, -0.3),
    0.45,
  );
  x.fillStyle = INK;
  for (let k = 0; k < 3; k += 1) x.fillRect(0.4 + k * 0.9, -1.8, 0.3, 2.4);
  fillPath(
    x,
    "M-.9 .1 L.9 .1 Q.2 2.4 -.4 4 L-2.6 3.6 Q-2.2 1.6 -.9 .1 Z",
    gradient(x, -2, 0, 1, 4, "#8a5530"),
    0.45,
  );
  x.fillStyle = "#e2b85a";
  x.fillRect(-1.5, 2, 0.6, 0.6);
  fillPath(x, "M.2 .8 Q1 2.4 2.2 .8", "rgba(0,0,0,0)", 0.4);
  x.fillStyle = "#dfe5e8";
  x.fillRect(0.8, -1.25, len - 1, 0.3);
  x.fillStyle = INK;
  x.fillRect(len - 0.6, -2, 0.6, 0.7);
}

function hatShape(x: Ctx, C: Palette, back = false) {
  fillPath(
    x,
    "M-4.8 -.2 C-5 -3.8 -4.4 -6.6 -2.8 -7.3 Q0 -6 2.8 -7.3 C4.4 -6.6 5 -3.8 4.8 -.2 Z",
    gradient(x, -5, -7, 5, 0, C.hat, 0.22, -0.3),
  );
  if (!back) {
    x.strokeStyle = shade(C.hat, -0.4);
    x.lineWidth = 0.4;
    x.beginPath();
    x.moveTo(0, -6);
    x.lineTo(0, -3);
    x.stroke();
  }
  fillPath(x, "M-4.85 -2.1 L4.85 -2.1 L4.8 -.6 L-4.8 -.6 Z", C.band, 0.35);
  if (!back) {
    // The concho.
    x.fillStyle = "#e2b85a";
    x.beginPath();
    x.arc(-3, -1.35, 0.55, 0, 7);
    x.fill();
  }
  fillPath(
    x,
    "M-10.8 -1.6 Q-9.6 .9 0 1.3 Q9.6 .9 10.8 -1.6 Q9.4 -.1 0 -.3 Q-9.4 -.1 -10.8 -1.6 Z",
    gradient(x, 0, -1.6, 0, 1.3, C.hat, 0.15, -0.35),
  );
  x.strokeStyle = shade(C.hat, 0.35);
  x.lineWidth = 0.3;
  x.beginPath();
  x.moveTo(-9, -0.4);
  x.quadraticCurveTo(0, 0.7, 9, -0.4);
  x.stroke();
}

export function hatFront(x: Ctx, cx: number, cy: number, C: Palette, rot = 0) {
  x.save();
  x.translate(cx, cy);
  x.rotate(rot);
  hatShape(x, C);
  x.restore();
}

export interface PoseFront {
  readonly t: number;
  readonly ph: number;
  readonly col: Palette;
  readonly face: HTMLCanvasElement | null;
  /** 0 holstered … 1 aimed. */
  readonly draw: number;
  readonly recoil: number;
  readonly hatOff: boolean;
}

/** The opponent, facing the camera. Returns the muzzle point in local units. */
export function cowboyFront(x: Ctx, o: PoseFront): Pt {
  const t = o.t;
  const C = o.col;
  const br = Math.sin(t * 0.0032 + o.ph) * 0.5;
  const w = Math.sin(t * 0.0021 + o.ph) * 1.4 + Math.sin(t * 0.0057) * 0.5;
  const sh = -43 + br;
  const LEA = "#6b3a1f";
  fillPath(
    x,
    `M-6.4 ${sh} L6.4 ${sh} L${8.6 - w * 0.6} -10.4 Q0 -9 ${-8.6 - w} -10.4 Z`,
    shade(C.coatD, -0.35),
    0.5,
  );
  for (const sd of [-1, 1]) {
    const L = sd < 0;
    fillPath(
      x,
      L
        ? "M-5.4 -26.5 C-5.8 -19 -5.6 -12 -5.2 -5.6 L-1.4 -5.6 C-1.2 -12 -.8 -19 -.5 -26.5 Z"
        : "M5.4 -26.5 C5.8 -19 5.6 -12 5.2 -5.6 L1.4 -5.6 C1.2 -12 .8 -19 .5 -26.5 Z",
      gradient(x, sd * -1, -26, sd * 6, -26, C.trou),
    );
    // Chaps, with their conchos.
    fillPath(
      x,
      L
        ? "M-5.6 -24.5 C-6.3 -17 -6.1 -11 -5.7 -6.2 L-3.9 -6.2 C-4.1 -12 -4.1 -18 -3.7 -24.5 Z"
        : "M5.6 -24.5 C6.3 -17 6.1 -11 5.7 -6.2 L3.9 -6.2 C4.1 -12 4.1 -18 3.7 -24.5 Z",
      gradient(x, sd * -4, -24, sd * -6, -24, LEA, 0.1, -0.35),
      0.45,
    );
    x.fillStyle = "#c89b3c";
    for (let k = 0; k < 5; k += 1) x.fillRect(sd * 4.6 - 0.15, -22 + k * 3.4, 0.35, 0.35);
    fillPath(
      x,
      L
        ? "M-5.7 -6.4 L-1.2 -6.4 L-1 -1.2 Q-1 .1 -2.4 .1 L-6.9 .1 Q-7.6 0 -6.9 -1.3 Z"
        : "M5.7 -6.4 L1.2 -6.4 L1 -1.2 Q1 .1 2.4 .1 L6.9 .1 Q7.6 0 6.9 -1.3 Z",
      gradient(x, 0, -6.4, 0, 0, C.boot, 0.25, -0.3),
      0.5,
    );
    x.fillStyle = shade(C.boot, 0.3);
    x.fillRect(sd * 4.6 - 0.9, -6.2, 1.8, 0.4);
    x.strokeStyle = "#c89b3c";
    x.lineWidth = 0.35;
    x.beginPath();
    x.arc(sd * 6.9, -1.2, 0.7, 0, 7);
    x.stroke();
  }
  fillPath(
    x,
    `M-5.6 ${sh} C-6.1 -36 -5.4 -30 -4.7 -26.4 L4.7 -26.4 C5.4 -30 6.1 -36 5.6 ${sh} Z`,
    gradient(x, -5, sh, 5, -26, C.shirt, 0.15, -0.25),
  );
  x.fillStyle = shade(C.shirt, -0.4);
  for (let k = 0; k < 4; k += 1) x.fillRect(-0.2, sh + 3 + k * 3.5, 0.45, 0.45);
  for (const sd of [-1, 1]) {
    fillPath(
      x,
      sd < 0
        ? `M-5.7 ${sh} C-6.1 -37 -5.5 -31 -4.9 -27.2 L-.8 -27.2 L-1 ${sh + 5.5} L-2.4 ${sh} Z`
        : `M5.7 ${sh} C6.1 -37 5.5 -31 4.9 -27.2 L.8 -27.2 L1 ${sh + 5.5} L2.4 ${sh} Z`,
      gradient(x, sd * -1, sh, sd * 6, -27, C.vest),
    );
  }
  x.strokeStyle = shade(C.vest, -0.45);
  x.lineWidth = 0.35;
  x.beginPath();
  x.moveTo(-4.4, -31.5);
  x.lineTo(-2, -31.5);
  x.moveTo(2, -31.5);
  x.lineTo(4.4, -31.5);
  x.stroke();
  x.strokeStyle = "#e2b85a";
  x.lineWidth = 0.3;
  x.beginPath();
  x.moveTo(-3.2, -31.3);
  x.quadraticCurveTo(-1.8, -29.4, -1, -30.6);
  x.stroke();
  x.fillStyle = "#e2b85a";
  x.beginPath();
  x.arc(-1.4, sh + 7, 0.4, 0, 7);
  x.arc(1.4, sh + 7, 0.4, 0, 7);
  x.fill();
  // Gun belt with bullet loops and buckle.
  fillPath(
    x,
    "M-5.9 -28.3 L5.9 -27.1 L6 -24.9 L-6 -25.7 Z",
    gradient(x, 0, -28, 0, -25, "#4a2814", 0.1, -0.3),
    0.45,
  );
  x.fillStyle = "#e2b85a";
  for (let k = 0; k < 8; k += 1) x.fillRect(-5.4 + k * 1.45, -27.9 + k * 0.15, 0.5, 1.3);
  fillPath(
    x,
    "M-1.4 -28.4 L1.4 -28.1 L1.4 -25.2 L-1.4 -25.5 Z",
    gradient(x, -1.4, -28.4, 1.4, -25.2, "#e2b85a", 0.3, -0.3),
    0.4,
  );
  // Tied-down holster, and the grip while the gun is in it.
  fillPath(
    x,
    "M-7.6 -25.8 L-4.9 -25.6 L-4.7 -16.6 Q-6 -15.4 -7.4 -16.6 Z",
    gradient(x, -7.6, -25, -4.7, -25, LEA, 0.15, -0.35),
    0.45,
  );
  x.strokeStyle = shade(LEA, -0.5);
  x.lineWidth = 0.35;
  x.beginPath();
  x.moveTo(-7.4, -18.4);
  x.lineTo(-4.7, -18.4);
  x.stroke();
  if (o.draw < 0.3) {
    fillPath(
      x,
      "M-7.2 -25.7 L-5.2 -25.6 L-5.5 -29.2 Q-6.6 -30 -7.7 -29.3 Z",
      gradient(x, -7.6, -30, -5, -26, "#8a5530"),
      0.4,
    );
  }
  // Duster, moving in the wind.
  for (const sd of [-1, 1]) {
    const ww = sd < 0 ? w : w * 0.6;
    fillPath(
      x,
      sd < 0
        ? `M-6.2 ${sh - 0.6} C-8.8 -36 -9.2 -24 ${-9.6 - ww} -10.8 L${-6.9 - ww * 0.6} -10.4 C-6.5 -20 -5.8 -31 -3.8 ${sh + 6.5} Z`
        : `M6.2 ${sh - 0.6} C8.8 -36 9.2 -24 ${9.6 - ww} -10.8 L${6.9 - ww * 0.6} -10.4 C6.5 -20 5.8 -31 3.8 ${sh + 6.5} Z`,
      gradient(x, sd * -4, sh, sd * -10, -12, C.coat, 0.25, -0.35),
    );
    fillPath(
      x,
      sd < 0
        ? `M-6.2 ${sh - 0.6} L-2.2 ${sh - 0.2} L-4 ${sh + 6.5} Z`
        : `M6.2 ${sh - 0.6} L2.2 ${sh - 0.2} L4 ${sh + 6.5} Z`,
      shade(C.coat, 0.15),
      0.45,
    );
  }
  arm(
    x,
    [6.8, sh + 1.4],
    [8.8 + Math.sin(t * 0.003 + o.ph) * 0.3, sh + 9.6],
    [8.3, sh + 17.4],
    1.9,
    1.6,
    C.coat,
    shade(C.shirt, -0.1),
    C.glove,
    -1,
  );
  fillPath(
    x,
    `M-1.4 ${sh - 4} L1.4 ${sh - 4} L1.5 ${sh + 0.5} L-1.5 ${sh + 0.5} Z`,
    gradient(x, -1.5, 0, 1.5, 0, "#b07a50", 0.1, -0.3),
    0.4,
  );
  // Bandana.
  fillPath(
    x,
    `M-3.8 ${sh - 1.3} Q0 ${sh + 0.4} 3.8 ${sh - 1.3} L0 ${sh + 4} Z`,
    gradient(x, 0, sh - 1, 0, sh + 4, C.band, 0.2, -0.3),
    0.45,
  );
  x.fillStyle = shade(C.band, -0.3);
  x.beginPath();
  x.arc(0, sh - 0.3, 0.7, 0, 7);
  x.fill();
  const hy = sh - 8.3;
  // Ears.
  for (const sd of [-1, 1]) {
    x.beginPath();
    x.ellipse(sd * 5.3, hy + 0.6, 0.9, 1.5, 0, 0, 7);
    x.fillStyle = "#b07a50";
    x.fill();
    x.strokeStyle = INK;
    x.lineWidth = 0.4;
    x.stroke();
  }
  x.save();
  const head = new Path2D();
  head.ellipse(0, hy, 5.2, 6.2, 0, 0, 7);
  x.clip(head);
  x.fillStyle = "#c68e5f";
  x.fillRect(-6, hy - 7, 12, 14);
  if (o.face) {
    x.imageSmoothingEnabled = false;
    x.drawImage(o.face, -6.4, hy - 6.6, 12.8, 12.8);
  }
  // The hat brim's shadow.
  x.fillStyle = "rgba(30,12,4,.5)";
  x.fillRect(-6, hy - 7, 12, 3.6);
  x.fillStyle = "rgba(30,12,4,.22)";
  x.fillRect(-6, hy - 3.4, 12, 1.6);
  x.restore();
  x.strokeStyle = INK;
  x.lineWidth = 0.7;
  x.stroke(head);
  if (!o.hatOff) hatFront(x, 0, hy - 3.8, C, Math.sin(t * 0.0021 + o.ph) * 0.02);
  const p = o.draw;
  const s0: Pt = [-6.8, sh + 1.4];
  const e0: Pt = [lerp(-8.9, -10.2, p), lerp(sh + 9.6, sh + 5.4, p)];
  const h0: Pt = [lerp(-8.2, -3.4, p), lerp(sh + 17.4, sh + 6.2 - o.recoil * 3, p)];
  arm(x, s0, e0, h0, 1.9, 1.6, C.coat, shade(C.shirt, -0.1), C.glove, 1);
  if (p > 0.3) {
    // The revolver, foreshortened: pointing at the camera.
    x.beginPath();
    x.arc(h0[0] + 0.5, h0[1] - 0.6, 2, 0, 7);
    x.fillStyle = gradient(
      x,
      h0[0] - 1.5,
      h0[1] - 2.6,
      h0[0] + 2.5,
      h0[1] + 1.4,
      "#9aa2a8",
      0.3,
      -0.35,
    );
    x.fill();
    x.strokeStyle = INK;
    x.lineWidth = 0.45;
    x.stroke();
    x.beginPath();
    x.arc(h0[0] + 0.5, h0[1] - 0.6, 0.8, 0, 7);
    x.fillStyle = INK;
    x.fill();
  }
  return [h0[0] + 0.5, h0[1] - 0.6];
}

export interface PoseBack {
  readonly t: number;
  readonly col: Palette;
  readonly face: HTMLCanvasElement | null;
  readonly draw: number;
  readonly recoil: number;
  /** The angle from the shoulder to the opponent's chest. */
  readonly aim: number;
  readonly hatOff: boolean;
  /** The gun has been dropped (a first foul). */
  readonly noGun: boolean;
}

/** The player, seen from behind over the shoulder. Returns the muzzle point in local units. */
export function cowboyBack(x: Ctx, o: PoseBack): Pt {
  const t = o.t;
  const C = o.col;
  const br = Math.sin(t * 0.0032) * 0.5;
  const w = Math.sin(t * 0.0021) * 1.6 + Math.sin(t * 0.0057) * 0.6;
  const sh = -44 + br;
  const LEA = "#6b3a1f";
  for (const sd of [-1, 1]) {
    fillPath(
      x,
      sd < 0
        ? "M-6.4 -25 C-6.8 -17 -6.6 -9 -6.2 0 L-1.4 0 C-1.2 -9 -.9 -17 -.5 -25 Z"
        : "M6.4 -25 C6.8 -17 6.6 -9 6.2 0 L1.4 0 C1.2 -9 .9 -17 .5 -25 Z",
      gradient(x, sd * -1, -25, sd * 7, -25, C.trou),
    );
    x.strokeStyle = shade(C.trou, -0.4);
    x.lineWidth = 0.35;
    x.beginPath();
    x.moveTo(sd * 3.6, -22);
    x.quadraticCurveTo(sd * 4.2, -12, sd * 3.8, -2);
    x.stroke();
  }
  fillPath(
    x,
    `M-9.4 ${sh + 1} C-10.4 -30 -10.8 -18 ${-11.4 - w} -8.6 Q${-6 - w * 0.6} ${-7.4 + Math.abs(w) * 0.3} 0 -8.2 Q${6 - w * 0.3} -7.6 ${11 - w * 0.5} -8.8 C10.6 -18 10.4 -30 9.4 ${sh + 1} Z`,
    gradient(x, -10, sh, 10, -8, C.coatD, 0.22, -0.38),
  );
  x.strokeStyle = shade(C.coatD, -0.5);
  x.lineWidth = 0.4;
  x.beginPath();
  x.moveTo(0, sh + 9);
  x.lineTo(-0.4 - w * 0.2, -8.4);
  x.moveTo(-6.5, sh + 12);
  x.quadraticCurveTo(-7.4 - w * 0.4, -20, -8.6 - w * 0.7, -9);
  x.moveTo(6.5, sh + 12);
  x.quadraticCurveTo(7.2 - w * 0.2, -20, 8.2 - w * 0.4, -9);
  x.stroke();
  fillPath(
    x,
    `M-9.6 ${sh} Q0 ${sh - 1.4} 9.6 ${sh} L9 ${sh + 9.5} Q0 ${sh + 11} -9 ${sh + 9.5} Z`,
    gradient(x, -9, sh, 9, sh + 9, C.coat, 0.25, -0.3),
  );
  x.strokeStyle = shade(C.coat, -0.45);
  x.lineWidth = 0.35;
  x.beginPath();
  x.moveTo(-9, sh + 9.5);
  x.quadraticCurveTo(0, sh + 11, 9, sh + 9.5);
  x.stroke();
  fillPath(
    x,
    "M-7.5 -25.6 L7.6 -25.2 L7.7 -23 L-7.6 -23.4 Z",
    gradient(x, 0, -25.6, 0, -23, "#4a2814", 0.1, -0.3),
    0.45,
  );
  x.fillStyle = "#e2b85a";
  for (let k = 0; k < 9; k += 1) x.fillRect(-7 + k * 1.6, -25.3, 0.55, 1.6);
  fillPath(
    x,
    "M8.2 -24.6 L11.2 -24.4 L11 -14.6 Q9.7 -13.6 8.6 -14.8 Z",
    gradient(x, 8, -24, 11.2, -24, LEA, 0.15, -0.35),
    0.45,
  );
  x.strokeStyle = shade(LEA, -0.5);
  x.lineWidth = 0.35;
  x.beginPath();
  x.moveTo(8.5, -16.6);
  x.lineTo(11, -16.6);
  x.stroke();
  if (o.draw < 0.3 && !o.noGun) {
    fillPath(
      x,
      "M8.6 -24.6 L10.8 -24.5 L11.3 -28.4 Q10 -29.2 8.8 -28.6 Z",
      gradient(x, 8.6, -29, 11.3, -24.5, "#8a5530"),
      0.4,
    );
  }
  arm(
    x,
    [-8.6, sh + 1.6],
    [-10.8 + Math.sin(t * 0.003) * 0.3, sh + 10],
    [-10.3, sh + 18],
    2.1,
    1.8,
    C.coatD,
    shade(C.shirt, -0.15),
    C.glove,
    1,
  );
  fillPath(
    x,
    `M-1.8 ${sh - 4.4} L1.8 ${sh - 4.4} L2 ${sh + 0.6} L-2 ${sh + 0.6} Z`,
    gradient(x, -2, 0, 2, 0, "#b07a50", 0.1, -0.35),
    0.4,
  );
  fillPath(
    x,
    `M-4.4 ${sh - 1} Q0 ${sh - 2.2} 4.4 ${sh - 1} L4 ${sh + 1.8} Q0 ${sh + 0.8} -4 ${sh + 1.8} Z`,
    gradient(x, -4, 0, 4, 0, C.band, 0.2, -0.3),
    0.45,
  );
  fillPath(x, `M-1.8 ${sh + 1.4} L1.4 ${sh + 1.2} L.2 ${sh + 4.6} Z`, shade(C.band, -0.15), 0.4);
  const hy = sh - 8.8;
  x.save();
  const head = new Path2D();
  head.ellipse(0, hy, 5.6, 6.4, 0, 0, 7);
  x.clip(head);
  x.fillStyle = "#c68e5f";
  x.fillRect(-7, hy - 7, 14, 14);
  if (o.face) {
    x.imageSmoothingEnabled = false;
    x.drawImage(o.face, -1.5, hy - 7.4, 14.8, 14.8);
  }
  x.fillStyle = "rgba(30,12,4,.45)";
  x.fillRect(-7, hy - 7, 14, 3.6);
  // Hair, seen from behind.
  x.beginPath();
  x.moveTo(-6, hy - 7);
  x.bezierCurveTo(1, hy - 6.6, 1.6, hy - 2, 0.6, hy + 1.2);
  x.bezierCurveTo(0.2, hy + 3.6, -0.6, hy + 5.6, -1.4, hy + 7);
  x.lineTo(-7, hy + 7);
  x.closePath();
  x.fillStyle = gradient(x, -6, hy - 6, 1, hy + 6, "#3a2414", 0.15, -0.35);
  x.fill();
  x.strokeStyle = "rgba(0,0,0,.35)";
  x.lineWidth = 0.35;
  for (let k = 0; k < 4; k += 1) {
    x.beginPath();
    x.moveTo(-5 + k * 1.3, hy - 3);
    x.quadraticCurveTo(-4.4 + k * 1.3, hy + 2, -5.2 + k * 1.2, hy + 6);
    x.stroke();
  }
  x.restore();
  x.strokeStyle = INK;
  x.lineWidth = 0.7;
  x.stroke(head);
  x.beginPath();
  x.ellipse(0.9, hy + 0.8, 1.1, 1.8, 0, 0, 7);
  x.fillStyle = "#b07a50";
  x.fill();
  x.strokeStyle = INK;
  x.lineWidth = 0.4;
  x.stroke();
  x.strokeStyle = "#8a5a3a";
  x.lineWidth = 0.3;
  x.beginPath();
  x.arc(1, hy + 0.8, 0.55, -1, 1.6);
  x.stroke();
  if (!o.hatOff) {
    x.save();
    x.translate(0, hy - 4.2);
    x.rotate(Math.sin(t * 0.0021) * 0.02);
    x.scale(1.06, 1.06);
    hatShape(x, C, true);
    x.restore();
  }
  const p = o.draw;
  const s0: Pt = [8.6, sh + 1.6];
  const ang = o.aim;
  const rest: readonly [Pt, Pt] = [
    [11.2, sh + 10],
    [10.8, -27.4],
  ];
  const Lf = lerp(1, 0.82, p);
  const e0: Pt = [
    lerp(rest[0][0], s0[0] + Math.cos(ang) * 8.5 * Lf, p),
    lerp(rest[0][1], s0[1] + Math.sin(ang) * 8.5 * Lf, p),
  ];
  const fa = ang - o.recoil * 0.9;
  const h0: Pt = [
    lerp(rest[1][0], e0[0] + Math.cos(fa) * 8 * Lf, p),
    lerp(rest[1][1], e0[1] + Math.sin(fa) * 8 * Lf, p),
  ];
  let tip: Pt = h0;
  if (p > 0.3 && !o.noGun) {
    x.save();
    x.translate(h0[0], h0[1]);
    x.rotate(fa);
    revolverSide(x, 7.6);
    x.restore();
    tip = [h0[0] + Math.cos(fa) * 7.8, h0[1] + Math.sin(fa) * 7.8];
  }
  arm(x, s0, e0, h0, 2.1, 1.8, C.coat, shade(C.shirt, -0.15), C.glove, -1);
  return tip;
}

/** A soft radial puff; `col` holds an `A` where the alpha goes. */
export function puff(x: Ctx, cx: number, cy: number, r: number, col: string, a: number) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, col.replace("A", String(a)));
  g.addColorStop(1, col.replace("A", "0"));
  x.fillStyle = g;
  x.beginPath();
  x.arc(cx, cy, r, 0, 7);
  x.fill();
}

/** Muzzle flash, `ft` ms after the shot, gone after 100 ms. */
export function flashAt(x: Ctx, mx: number, my: number, ft: number, sc: number, ang: number) {
  if (ft >= 100) return;
  const a = 1 - ft / 100;
  x.save();
  x.translate(mx, my);
  x.rotate(ang);
  x.scale(sc, sc);
  puff(x, 3, 0, 12 * (0.6 + 0.4 * a), "rgba(246,190,90,A)", a * 0.9);
  x.beginPath();
  for (let i = 0; i < 12; i += 1) {
    const an = (i / 12) * Math.PI * 2;
    const rr = i % 2 ? 2 : (i % 4 === 0 ? 11 : 6) * (0.7 + 0.3 * a);
    x.lineTo(4 + Math.cos(an) * rr * 1.2, Math.sin(an) * rr * 0.75);
  }
  x.closePath();
  x.globalAlpha = a;
  x.fillStyle = "#f6d27a";
  x.fill();
  x.fillStyle = "#fff4d0";
  x.beginPath();
  x.ellipse(2.5, 0, 3.5, 1.5, 0, 0, 7);
  x.fill();
  x.globalAlpha = 1;
  x.restore();
}

function blob(x: Ctx, cx: number, cy: number, r: number, k: number, fill: string) {
  const N = 22;
  const pts: Pt[] = [];
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    const rr =
      r * (0.74 + 0.22 * Math.sin(a * 5 + k) * Math.sin(a * 3 - k * 2) + 0.14 * hash(i + k * 9));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const at = (i: number): Pt => pts[(i + N) % N] ?? [cx, cy];
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  x.beginPath();
  const s0 = mid(at(N - 1), at(0));
  x.moveTo(s0[0], s0[1]);
  for (let i = 0; i < N; i += 1) {
    const q = mid(at(i), at(i + 1));
    x.quadraticCurveTo(at(i)[0], at(i)[1], q[0], q[1]);
  }
  x.closePath();
  x.fillStyle = fill;
  x.fill();
}

const SPLATS = [
  [0.16, 0.2, 24],
  [0.84, 0.3, 20],
  [0.74, 0.78, 27],
  [0.24, 0.74, 17],
  [0.5, 0.1, 11],
  [0.05, 0.52, 13],
  [0.96, 0.62, 11],
] as const;

/** Seven blood splats that grow, with drips that run for about 2.6 s. */
export function drawBloodSplats(x: Ctx, bt: number) {
  const grow = easeOut(clamp01(bt / 200));
  SPLATS.forEach(([sx, sy, r0], k) => {
    const cx = sx * W;
    const cy = sy * H;
    const r = r0 * grow;
    if (r < 0.5) return;
    for (let i = 0; i < 3; i += 1) {
      const dx = cx + (hash(k * 31 + i) - 0.5) * r * 1.1;
      const top = cy + r * 0.35;
      const len = easeOut(clamp01((bt - 220 - i * 140) / 2600)) * (14 + hash(k + i * 7) * 30);
      const w = 1.4 + hash(k * 3 + i) * 1.4;
      if (len <= 0) continue;
      x.strokeStyle = "#6e0a0a";
      x.lineCap = "round";
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(dx, top);
      x.lineTo(dx, top + len);
      x.stroke();
      x.fillStyle = "#6e0a0a";
      x.beginPath();
      x.arc(dx, top + len, w * 0.85, 0, 7);
      x.fill();
    }
    blob(x, cx, cy, r, k, "#5e0808");
    blob(x, cx, cy, r * 0.82, k + 3, "#860f0f");
    blob(x, cx - r * 0.05, cy - r * 0.05, r * 0.55, k + 7, "#a51616");
    x.globalAlpha = 0.5;
    x.fillStyle = "#e06060";
    x.beginPath();
    x.ellipse(cx - r * 0.3, cy - r * 0.32, r * 0.14, r * 0.06, -0.5, 0, 7);
    x.fill();
    x.globalAlpha = 1;
    for (let i = 0; i < 11; i += 1) {
      const an = hash(k * 17 + i) * Math.PI * 2;
      const d = r * (1.1 + hash(k * 5 + i) * 0.95);
      const dr = (0.5 + hash(i + k) * 1.7) * grow;
      x.fillStyle = i % 3 ? "#7a0c0c" : "#9e1414";
      x.beginPath();
      x.arc(cx + Math.cos(an) * d, cy + Math.sin(an) * d, dr, 0, 7);
      x.fill();
    }
  });
}

/**
 * Flattens a layer drawn with smooth paths into pixels: alpha thresholded at
 * 120, colours quantised to 18 steps; then composites it onto `target` and
 * clears it for the next figure.
 */
export function flattenLayer(layer: Ctx, target: Ctx) {
  const c = layer.canvas;
  const d = layer.getImageData(0, 0, c.width, c.height);
  const a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const alpha = a[i + 3] ?? 0;
    if (alpha < 120) {
      a[i + 3] = 0;
      continue;
    }
    const k = 255 / alpha;
    for (let ch = 0; ch < 3; ch += 1) {
      a[i + ch] = Math.min(255, Math.round(((a[i + ch] ?? 0) * k) / 18) * 18);
    }
    a[i + 3] = 255;
  }
  layer.putImageData(d, 0, 0);
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.drawImage(c, 0, 0);
  target.restore();
  layer.save();
  layer.setTransform(1, 0, 0, 1, 0, 0);
  layer.clearRect(0, 0, c.width, c.height);
  layer.restore();
}

/** An image drawn to cover a 512 × 288 canvas: the scene backgrounds at 2×. */
export function fitCanvas(im: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 288;
  const x = c.getContext("2d");
  if (!x) return c;
  const s = Math.max(512 / im.naturalWidth, 288 / im.naturalHeight);
  x.imageSmoothingEnabled = s < 1;
  x.imageSmoothingQuality = "high";
  const w = im.naturalWidth * s;
  const h = im.naturalHeight * s;
  x.drawImage(im, (512 - w) / 2, (288 - h) / 2, w, h);
  return c;
}

/**
 * The built-in street, drawn when `street.png` cannot be loaded: a dithered
 * sunset, mesas, the road and two storefronts.
 */
export function buildStreet(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  if (!x) return c;
  const f = (X: number, Y: number, w: number, h: number, col: string) => {
    x.fillStyle = col;
    x.fillRect(X, Y, w, h);
  };
  const dither = (xx: number, y: number) => (BAYER[(y & 3) * 4 + (xx & 3)] ?? 0) / 16;
  const sky = ["#2a1430", "#4a1d36", "#7a2a36", "#b3463a", "#dc7a42", "#efb25a"];
  const hz = 98;
  for (let y = 0; y < hz; y += 1) {
    const fv = (y / hz) * (sky.length - 1);
    const b = Math.floor(fv);
    const fr = fv - b;
    for (let xx = 0; xx < W; xx += 1) {
      f(xx, y, 1, 1, (dither(xx, y) < fr ? sky[Math.min(b + 1, 5)] : sky[b]) ?? "#2a1430");
    }
  }
  for (let y = 56; y < hz; y += 1) {
    for (let xx = 100; xx < 156; xx += 1) {
      const d = Math.hypot(xx - 128, y - 80);
      if (d <= 22 && !(y > 80 && y % 4 === 0)) f(xx, y, 1, 1, y < 80 ? "#f7dc8a" : "#f3c070");
    }
  }
  for (let xx = 0; xx < W; xx += 1) {
    const hh = 90 + Math.round(Math.sin(xx * 0.045) * 3 + Math.sin(xx * 0.13 + 1) * 2);
    f(xx, hh, 1, hz - hh, "#7a3a2c");
  }
  const mesa = (x0: number, x1: number, top: number, col: string) => {
    for (let xx = x0; xx < x1; xx += 1) {
      const e = Math.min(xx - x0, x1 - xx);
      const tt = e < 6 ? top + (6 - e) * 2 : top;
      f(xx, tt, 1, hz - tt, col);
    }
  };
  mesa(18, 84, 76, "#5a2622");
  mesa(176, 236, 80, "#5a2622");
  mesa(60, 96, 84, "#6b2e26");
  for (let y = hz; y < H; y += 1) {
    const fr = (y - hz) / (H - hz);
    for (let xx = 0; xx < W; xx += 1)
      f(xx, y, 1, 1, dither(xx, y) < fr * 0.7 ? "#a8693a" : "#c48448");
  }
  for (let y = hz; y < H; y += 1) {
    const hw = Math.round(8 + ((y - hz) / (H - hz)) * 96);
    f(128 - hw, y, hw * 2, 1, y & 1 ? "#d39a5e" : "#cf955a");
    f(128 - Math.round(hw * 0.45), y, 1, 1, "#b0763f");
    f(128 + Math.round(hw * 0.45), y, 1, 1, "#b0763f");
  }
  const building = (x0: number, w: number, body: string, trim: string, flip: boolean) => {
    f(x0 - 1, 47, w + 2, 63, "#1a0c06");
    f(x0, 48, w, 62, body);
    f(x0 + 4, 52, w - 8, 8, trim);
    for (let k = 0; k < 6; k += 1) f(x0 + 7 + k * 5, 55, 3, 2, "#f3e6c8");
    for (const [a, b] of [
      [x0 + 6, 66],
      [x0 + w - 16, 66],
    ] as const) {
      f(a - 1, b - 1, 12, 12, "#1a0c06");
      f(a, b, 10, 10, "#f3c977");
      f(a + 4, b, 1, 10, "#1a0c06");
      f(a, b + 4, 10, 1, "#1a0c06");
    }
    f(flip ? x0 - 4 : x0, 84, w + 4, 3, "#2c160c");
    f(flip ? x0 - 3 : x0 + 1, 87, 2, 23, "#2c160c");
    f(flip ? x0 + w - 1 : x0 + w + 1, 87, 2, 23, "#2c160c");
    f(x0 + w / 2 - 6, 92, 5, 12, "#2c160c");
    f(x0 + w / 2 + 1, 92, 5, 12, "#2c160c");
    for (let y = 49; y < 110; y += 3) f(x0, y, w, 1, "rgba(0,0,0,0.12)");
  };
  building(0, 44, "#5a2e18", "#8a5530", false);
  building(212, 44, "#4a3020", "#6b4a2a", true);
  f(0, 110, 48, 2, "#2c160c");
  f(208, 110, 48, 2, "#2c160c");
  return c;
}

/**
 * A member's picture as pixel art: cropped (`face` keeps the head, `bust` the
 * whole square), drawn small, quantised to steps of 10 and outlined in ink.
 * Null until the image has loaded, or when the browser refuses to read it.
 */
export function pixelateAvatar(
  im: HTMLImageElement,
  n: number,
  crop: "face" | "bust",
): HTMLCanvasElement | null {
  if (!im.complete || !im.naturalWidth) return null;
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  const x = c.getContext("2d", { willReadFrequently: true });
  if (!x) return null;
  const w = im.naturalWidth;
  const h = im.naturalHeight;
  const [sx, sy, s] = crop === "face" ? [w * 0.17, h * 0.02, w * 0.66] : [0, 0, Math.min(w, h)];
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(im, sx, sy, s, s, 1, 1, n - 2, n - 2);
  let d: ImageData;
  try {
    d = x.getImageData(0, 0, n, n);
  } catch {
    // A picture served without CORS taints the canvas; the caller falls back.
    return null;
  }
  const a = d.data;
  const opaque = new Uint8Array(n * n);
  const q = (v: number) => Math.max(0, Math.min(255, Math.round(v / 10) * 10));
  for (let p = 0; p < n * n; p += 1) {
    const o = p * 4;
    if ((a[o + 3] ?? 0) < 110) {
      a[o + 3] = 0;
      continue;
    }
    opaque[p] = 1;
    a[o] = q(a[o] ?? 0);
    a[o + 1] = q(a[o + 1] ?? 0);
    a[o + 2] = q(a[o + 2] ?? 0);
    a[o + 3] = 255;
  }
  let count = 0;
  for (let y = 0; y < n; y += 1) {
    for (let xx = 0; xx < n; xx += 1) {
      const p = y * n + xx;
      if (opaque[p]) {
        count += 1;
        continue;
      }
      const edge =
        (xx > 0 && opaque[p - 1]) ||
        (xx < n - 1 && opaque[p + 1]) ||
        (y > 0 && opaque[p - n]) ||
        (y < n - 1 && opaque[p + n]);
      if (edge) {
        const o = p * 4;
        a[o] = 13;
        a[o + 1] = 8;
        a[o + 2] = 5;
        a[o + 3] = 255;
      }
    }
  }
  if (!count) return null;
  x.putImageData(d, 0, 0);
  return c;
}
