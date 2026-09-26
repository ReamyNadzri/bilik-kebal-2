import { PixelArt } from "./pixel-art";
import type { WantedPicture } from "@/contracts/wanted-pictures";
import {
  EMBLEM_DRAWINGS,
  PIXEL_PALETTE,
  PRESET_PICTURES,
} from "@/features/presentation/pixel-drawings";
import { emblemForWanted } from "@/features/presentation/resource-emblem";

export interface ResourceEmblemProps {
  /** The resource type label as the taxonomy words it. */
  readonly resourceType: string;
  /** The request kind; missing items and discussions have their own drawing. */
  readonly kind?: "academic" | "missing_item" | "discussion";
  /** The poster's chosen picture, shown instead of the automatic drawing. */
  readonly picture?: WantedPicture | null;
}

/**
 * The portrait frame of a Wanted poster: the poster's chosen picture (one of
 * the fifty drawings, or their own pixelated upload), else a drawing of the
 * kind of resource wanted. Decorative: the resource type is written on the
 * poster.
 */
export function ResourceEmblem({
  resourceType,
  kind = "academic",
  picture = null,
}: ResourceEmblemProps) {
  if (picture?.kind === "upload") {
    return (
      <div className="emblem-frame" data-emblem="upload">
        {/* eslint-disable-next-line @next/next/no-img-element -- A small public pixelated PNG, already sized in the browser before upload. */}
        <img
          className="resource-emblem resource-emblem--upload"
          src={picture.url}
          alt=""
          // A Board carries dozens of posters: only those near the screen load.
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }
  const preset = picture?.kind === "preset" ? PRESET_PICTURES[picture.preset] : undefined;
  const emblem = emblemForWanted(kind, resourceType);
  return (
    <div className="emblem-frame" data-emblem={preset ? "preset" : emblem}>
      <PixelArt
        rows={preset?.rows ?? EMBLEM_DRAWINGS[emblem]}
        palette={PIXEL_PALETTE}
        className="resource-emblem"
      />
    </div>
  );
}
