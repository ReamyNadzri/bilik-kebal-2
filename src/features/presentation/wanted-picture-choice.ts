"use client";

import type {
  SetWantedPictureResult,
  WantedPicture,
  WantedPictureCode,
  WantedPictureUploadResult,
} from "@/contracts/wanted-pictures";
import { callOperation } from "./call-operation";

/**
 * What the poster picked in the picture picker, before it is saved: the
 * automatic drawing, one of the fifty drawings, or their own pixelated upload
 * (held in the browser until the Wanted exists).
 */
export type WantedPictureChoice =
  | { readonly kind: "auto" }
  | { readonly kind: "preset"; readonly preset: number }
  | { readonly kind: "upload"; readonly blob: Blob; readonly previewUrl: string };

export const AUTO_PICTURE: WantedPictureChoice = { kind: "auto" };

/** How a choice looks on the poster, for previews before it is saved. */
export function choiceAsPicture(choice: WantedPictureChoice): WantedPicture | null {
  if (choice.kind === "preset") return { kind: "preset", preset: choice.preset };
  if (choice.kind === "upload") return { kind: "upload", url: choice.previewUrl };
  return null;
}

/**
 * Saves a choice onto a Wanted, by its public id or, for a draft, its id. An
 * upload goes straight from the browser to the caller's own storage folder;
 * this app's server never handles the file.
 */
export async function saveWantedPicture(
  ref: string,
  choice: WantedPictureChoice,
): Promise<SetWantedPictureResult> {
  let body: { preset: number | null; objectKey: string | null } = {
    preset: null,
    objectKey: null,
  };
  if (choice.kind === "preset") body = { preset: choice.preset, objectKey: null };
  if (choice.kind === "upload") {
    const slot = await callOperation<
      Extract<WantedPictureUploadResult, { ok: true }>["data"],
      WantedPictureCode
    >("/api/marketplace/wanted/picture-upload", {}, "PICTURE_UNAVAILABLE");
    if (!slot.ok) return slot;
    const stored = await fetch(slot.data.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: choice.blob,
    }).catch(() => null);
    if (!stored?.ok) {
      return {
        ok: false,
        code: "PICTURE_UNAVAILABLE",
        message: "The picture could not be uploaded. Try again.",
      };
    }
    body = { preset: null, objectKey: slot.data.objectKey };
  }
  return callOperation<{ done: true }, WantedPictureCode>(
    `/api/marketplace/wanted/${encodeURIComponent(ref)}/picture`,
    body,
    "PICTURE_UNAVAILABLE",
  );
}
