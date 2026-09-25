import { z } from "zod";
import type { OperationResult } from "./operation-result";

/**
 * The small picture on a Wanted poster (migration 202610120001). The poster
 * picks one of fifty drawn pictures or uploads their own; the browser crops,
 * shrinks and pixelates an upload into a small PNG before it leaves the
 * device. A picture shows at once; a Sheriff who moderates the Wanted, or the
 * Owner, can remove it. Without one, the poster shows the drawing that fits
 * its kind and resource type.
 */

export const WANTED_PICTURE_PRESET_COUNT = 50;
/** Upper bound the bucket enforces too. */
export const WANTED_PICTURE_MAX_BYTES = 65_536;
/** The saved PNG's edge: a pixel grid scaled up with hard edges. */
export const WANTED_PICTURE_SIZE_PX = 192;
/** "<poster public id>/<uuid>.png" in the public `wanted-pictures` bucket. */
export const WANTED_PICTURE_OBJECT_KEY = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/;

export type WantedPicture =
  | { readonly kind: "preset"; readonly preset: number }
  | { readonly kind: "upload"; readonly url: string };

export type WantedPictureCode =
  | "AUTH_REQUIRED"
  | "NOT_AUTHORIZED"
  | "VALIDATION_ERROR"
  | "WANTED_NOT_FOUND"
  | "PICTURE_NOT_UPLOADED"
  | "PICTURE_UNAVAILABLE";

/** Exactly one of preset and object key, or neither to go back to the automatic drawing. */
export const setWantedPictureSchema = z
  .object({
    preset: z
      .number()
      .int()
      .min(0)
      .max(WANTED_PICTURE_PRESET_COUNT - 1)
      .nullable(),
    objectKey: z.string().regex(WANTED_PICTURE_OBJECT_KEY).nullable(),
  })
  .refine((value) => value.preset === null || value.objectKey === null);
export type SetWantedPictureInput = z.infer<typeof setWantedPictureSchema>;

export const removeWantedPictureSchema = z.object({
  reasonCode: z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
});

export type SetWantedPictureResult = OperationResult<{ done: true }, WantedPictureCode>;
export type WantedPictureUploadResult = OperationResult<
  { signedUrl: string; objectKey: string },
  WantedPictureCode
>;
