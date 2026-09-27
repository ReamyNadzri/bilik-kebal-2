import Link from "next/link";
import type { CSSProperties } from "react";
import { Avatar } from "./avatar";
import type { PublicHunter } from "@/contracts/profiles";
import { posterKey, posterLook } from "@/features/presentation/hunters-wall-layout";

export interface MissingPosterProps {
  readonly hunter: PublicHunter;
  /**
   * `wall` and `flat` are links to the member's profile, on the Hunters wall
   * and the homepage grid. `big` is the profile page's own copy: not a link,
   * and hidden from assistive technology because the profile states the same
   * facts in text beside it.
   */
  readonly variant?: "wall" | "flat" | "big";
}

const SINCE = new Intl.DateTimeFormat("en-MY", {
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kuala_Lumpur",
});

export function hunterProfileHref(publicId: string): string {
  return `/u/${encodeURIComponent(publicId)}?from=hunters`;
}

/**
 * A member as an aged "MISSING" poster: their picture, name, verified
 * institution and the month they joined. The tilt, crease, stain and pin come
 * from the member's public id, so a poster looks the same on every visit.
 */
export function MissingPoster({ hunter, variant = "wall" }: MissingPosterProps) {
  const look = posterLook(posterKey(hunter.publicId), variant === "flat");
  const style = {
    "--poster-rotate": `${look.rotate}deg`,
    "--poster-crease": `${look.creaseAngle}deg`,
    "--poster-stain": `${look.stainX}% ${look.stainY}%`,
  } as CSSProperties;
  const className = `missing-poster missing-poster--${variant} missing-poster--${look.fixing}`;
  const body = (
    <>
      <span className="missing-poster__fixing" aria-hidden="true" />
      <span className="missing-poster__heading">Missing</span>
      <span className="missing-poster__frame">
        <Avatar
          src={hunter.avatarUrl}
          alt=""
          size={variant === "big" ? 320 : 176}
          className="missing-poster__photo"
        />
      </span>
      <span className="missing-poster__name">{hunter.displayName}</span>
      <span className="missing-poster__institution">{hunter.institutionName}</span>
      <span className="missing-poster__since">
        Since <time dateTime={hunter.joinedAt}>{SINCE.format(new Date(hunter.joinedAt))}</time>
      </span>
    </>
  );

  if (variant === "big") {
    return (
      <div className={className} style={style} aria-hidden="true">
        {body}
      </div>
    );
  }

  // Not prefetched: a profile is rendered per request, so a prefetch per
  // poster on sight would cost a server request each and save the click nothing.
  return (
    <Link
      className={className}
      style={style}
      href={hunterProfileHref(hunter.publicId)}
      prefetch={false}
      aria-label={`View profile of ${hunter.displayName}`}
    >
      {body}
    </Link>
  );
}
