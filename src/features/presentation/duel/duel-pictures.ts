import { pixelateAvatar } from "./duel-art";

/** The drawn default character, served from this site, so it can always be read. */
export const DEFAULT_PICTURE = "/brand/avatar-1.webp";

const images = new Map<string, Promise<HTMLImageElement>>();
const pixels = new Map<string, HTMLCanvasElement | null>();

function load(src: string): Promise<HTMLImageElement> {
  const known = images.get(src);
  if (known) return known;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    // Uploaded and Google pictures live on other origins; reading their pixels needs CORS.
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Picture ${src} did not load`));
    image.src = src;
  });
  pending.catch(() => images.delete(src));
  images.set(src, pending);
  return pending;
}

/**
 * A member's picture as pixel art, `size` pixels square. Falls back to the
 * drawn default when their picture cannot be loaded or read; null only when
 * even that fails.
 */
export async function pixelPicture(
  src: string | null,
  size: number,
  crop: "face" | "bust",
): Promise<HTMLCanvasElement | null> {
  for (const candidate of src && src !== DEFAULT_PICTURE
    ? [src, DEFAULT_PICTURE]
    : [DEFAULT_PICTURE]) {
    const key = `${candidate}|${size}|${crop}`;
    if (pixels.has(key)) {
      const cached = pixels.get(key) ?? null;
      if (cached) return cached;
      continue;
    }
    try {
      const art = pixelateAvatar(await load(candidate), size, crop);
      pixels.set(key, art);
      if (art) return art;
    } catch {
      pixels.set(key, null);
    }
  }
  return null;
}

/** The picture behind a scene, loaded once. Null when it cannot be loaded. */
export function scenePicture(src: string): Promise<HTMLImageElement | null> {
  return load(src).catch(() => null);
}
