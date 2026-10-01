"use client";

import { AVATAR_MAX_BYTES, AVATAR_SIZE_PX } from "@/contracts/profiles";

/**
 * Saving a profile picture from a canvas: encode it as WebP under the size
 * limit, upload it to the one-time slot the server issues, then record it as
 * the member's picture. Shared by the photo editor and the pixel-art pickers,
 * so every picture takes the same checked path.
 */

const QUALITIES = [0.9, 0.8, 0.7, 0.6, 0.5];

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

/** Resolves with the saved picture's public URL; throws when anything fails. */
export async function uploadAvatarCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  let blob: Blob | null = null;
  for (const quality of QUALITIES) {
    blob = await toBlob(canvas, quality);
    if (blob && blob.size <= AVATAR_MAX_BYTES) break;
  }
  if (!blob || blob.size > AVATAR_MAX_BYTES || blob.type !== "image/webp") {
    throw new Error("encode");
  }

  const slot = await fetch("/api/profile/avatar/upload-url", { method: "POST" });
  const slotBody = (await slot.json()) as
    { ok: true; data: { objectKey: string; signedUrl: string } } | { ok: false; message: string };
  if (!slotBody.ok) throw new Error(slotBody.message);

  const stored = await fetch(slotBody.data.signedUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": "image/webp" },
  });
  if (!stored.ok) throw new Error("upload");

  const saved = await fetch("/api/profile/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objectKey: slotBody.data.objectKey }),
  });
  const savedBody = (await saved.json()) as
    { ok: true; data: { avatarUrl: string | null } } | { ok: false; message: string };
  if (!savedBody.ok) throw new Error(savedBody.message);
  return savedBody.data.avatarUrl;
}

function blankAvatarCanvas(): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE_PX;
  canvas.height = AVATAR_SIZE_PX;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * A pixel-art picture (the Wanted picture editor's PNG) blown up to the avatar
 * size with hard pixel edges.
 */
export async function pixelBlobToAvatarCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image"));
      img.src = url;
    });
    const { canvas, context } = blankAvatarCanvas();
    context.drawImage(image, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * One of the drawn pictures as an avatar: the drawing's cells on the emblem
 * backdrop. Each colour letter's colour is read from the stylesheet class the
 * drawing already uses on screen, so the avatar matches the poster drawing.
 */
export function drawingToAvatarCanvas(
  rows: readonly string[],
  palette: Readonly<Record<string, string>>,
): HTMLCanvasElement {
  const { canvas, context } = blankAvatarCanvas();
  context.fillStyle = token("--bg-emblem", "#e9dcc0");
  context.fillRect(0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);

  const colours = new Map<string, string>();
  const probe = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "absolute";
  probe.style.width = "0";
  probe.style.height = "0";
  document.body.append(probe);
  try {
    for (const [letter, className] of Object.entries(palette)) {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("class", className);
      probe.append(rect);
      colours.set(letter, getComputedStyle(rect).fill || "#000");
    }
  } finally {
    probe.remove();
  }

  const cells = Math.max(rows.length, ...rows.map((row) => row.length));
  const margin = Math.round(AVATAR_SIZE_PX * 0.1);
  const cell = Math.floor((AVATAR_SIZE_PX - margin * 2) / cells);
  const offset = Math.floor((AVATAR_SIZE_PX - cell * cells) / 2);
  rows.forEach((row, y) => {
    [...row].forEach((letter, x) => {
      const colour = colours.get(letter);
      if (colour === undefined) return;
      context.fillStyle = colour;
      context.fillRect(offset + x * cell, offset + y * cell, cell, cell);
    });
  });
  return canvas;
}
