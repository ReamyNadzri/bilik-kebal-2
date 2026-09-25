import Image from "next/image";

export interface AvatarProps {
  /** Public avatar URL, or null for the drawn default character. */
  readonly src: string | null;
  /** Empty when a visible name sits beside the picture. */
  readonly alt?: string;
  readonly size?: number;
  readonly className?: string;
}

const DEFAULT_AVATAR = "/brand/avatar-1.webp";

/**
 * A member's picture: their uploaded avatar, or the drawn default. Uploaded
 * avatars are already cropped, square WebP from the public `avatars` bucket,
 * so they are rendered as-is (`unoptimized`).
 */
export function Avatar({ src, alt = "", size = 40, className = "" }: AvatarProps) {
  return (
    <Image
      className={`avatar-photo ${src ? "" : "avatar-photo--default"} ${className}`.trim()}
      src={src ?? DEFAULT_AVATAR}
      alt={alt}
      width={size}
      height={size}
      unoptimized
    />
  );
}
