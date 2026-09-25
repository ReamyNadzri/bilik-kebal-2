import type { MemberBadge } from "@/contracts/console";

/**
 * An Owner-awarded badge beside a member's name. Always named in text, so it
 * never depends on the image, and styled apart from the institution-verified
 * star: the two mean different things.
 */
export function MemberBadgeMark({ badge }: { readonly badge: MemberBadge | null | undefined }) {
  if (!badge) return null;
  return (
    <span className="member-badge" title={`Badge awarded by the Owner: ${badge.name}`}>
      {badge.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Owner-uploaded public image.
        <img className="member-badge__image" src={badge.imageUrl} alt="" width={18} height={18} />
      ) : null}
      <span>{badge.name}</span>
    </span>
  );
}
