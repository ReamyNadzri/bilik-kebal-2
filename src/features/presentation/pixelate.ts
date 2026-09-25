import { WANTED_PICTURE_SIZE_PX } from "@/contracts/wanted-pictures";

/** How coarse the pixel grid of an uploaded Wanted picture is: cells per side. */
export const PIXEL_GRIDS = [
  { cells: 16, label: "Chunky (16 × 16)" },
  { cells: 24, label: "Classic (24 × 24)" },
  { cells: 32, label: "Fine (32 × 32)" },
] as const;
export type PixelGrid = (typeof PIXEL_GRIDS)[number]["cells"];

/** Colour steps per channel for the retro look; "natural" keeps every colour. */
export const RETRO_LEVELS = 5;

export interface Framing {
  /** 1 fills the square; above 1 zooms in. */
  readonly zoom: number;
  /** Offset of the image centre from the square's centre, as a fraction of its edge. */
  readonly x: number;
  readonly y: number;
}

export const START_FRAMING: Framing = { zoom: 1, x: 0, y: 0 };

/**
 * Rounds each colour channel to one of `levels` evenly spaced steps, in place.
 * Alpha is left alone. Pure, so it is tested without a canvas.
 */
export function posterize(data: Uint8ClampedArray, levels: number): Uint8ClampedArray {
  if (levels < 2) return data;
  const step = 255 / (levels - 1);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      data[i + c] = Math.round(Math.round((data[i + c] ?? 0) / step) * step);
    }
  }
  return data;
}

/**
 * Where the image is drawn inside a square of `size`: cover the square, then
 * apply the member's zoom and offset. Shared by the cropping stage and the
 * pixelated output, so what they framed is what is saved.
 */
export function coverRect(
  imageWidth: number,
  imageHeight: number,
  framing: Framing,
  size: number,
): { x: number; y: number; width: number; height: number } {
  const scale = Math.max(size / imageWidth, size / imageHeight) * framing.zoom;
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (size - width) / 2 + framing.x * size,
    y: (size - height) / 2 + framing.y * size,
    width,
    height,
  };
}

/**
 * The pixel-art version of the framed picture: drawn small (one pixel per
 * grid cell, the browser averaging each cell), optionally reduced to a retro
 * palette, then scaled up with hard edges to the saved size. Re-encoding in
 * the browser also drops camera metadata. Null where canvas is unavailable.
 */
export function renderPixelPicture(
  image: HTMLImageElement,
  framing: Framing,
  cells: PixelGrid,
  retro: boolean,
  backdrop: string,
): HTMLCanvasElement | null {
  const small = document.createElement("canvas");
  small.width = cells;
  small.height = cells;
  const smallContext = small.getContext("2d");
  if (!smallContext) return null;
  smallContext.imageSmoothingEnabled = true;
  smallContext.imageSmoothingQuality = "high";
  smallContext.fillStyle = backdrop;
  smallContext.fillRect(0, 0, cells, cells);
  const rect = coverRect(image.naturalWidth, image.naturalHeight, framing, cells);
  smallContext.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  if (retro) {
    const pixels = smallContext.getImageData(0, 0, cells, cells);
    posterize(pixels.data, RETRO_LEVELS);
    smallContext.putImageData(pixels, 0, 0);
  }

  const out = document.createElement("canvas");
  out.width = WANTED_PICTURE_SIZE_PX;
  out.height = WANTED_PICTURE_SIZE_PX;
  const outContext = out.getContext("2d");
  if (!outContext) return null;
  outContext.imageSmoothingEnabled = false;
  outContext.drawImage(small, 0, 0, WANTED_PICTURE_SIZE_PX, WANTED_PICTURE_SIZE_PX);
  return out;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
