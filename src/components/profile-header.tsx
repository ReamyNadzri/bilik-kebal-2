import type { ReactNode } from "react";
import { Avatar } from "./avatar";
import { MemberBadgeMark } from "./member-badge-mark";
import type { MemberBadge } from "@/contracts/console";
import { formatJoined } from "@/features/marketplace/time";

export interface ProfileHeaderProps {
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly bio: string | null;
  readonly joinedAt: string | null;
  readonly institutionName: string | null;
  readonly institutionVerified: boolean;
  /** The Owner-awarded badge, shown apart from the verified star. */
  readonly badge?: MemberBadge | null;
  readonly stats: readonly { readonly label: string; readonly value: string }[];
  /** Edit controls on the member's own profile; nothing on someone else's. */
  readonly actions?: ReactNode;
  /** Replaces the picture, e.g. with a button that opens the editor. */
  readonly avatarSlot?: ReactNode;
}

/**
 * The top of a profile: picture, name with the verification badge, institution
 * and joined date, a short bio and a row of counts. The same card serves a
 * member's own profile and the public view of anyone else's.
 */
export function ProfileHeader({
  displayName,
  avatarUrl,
  bio,
  joinedAt,
  institutionName,
  institutionVerified,
  badge = null,
  stats,
  actions,
  avatarSlot,
}: ProfileHeaderProps) {
  return (
    <section className="panel profile-header" aria-labelledby="profile-name">
      <div className="profile-header__picture">
        {avatarSlot ?? (
          <Avatar src={avatarUrl} alt="" size={132} className="profile-header__avatar" />
        )}
      </div>
      <div className="profile-header__body">
        <div className="profile-header__title-row">
          <h1 id="profile-name" className="profile-header__name">
            {displayName}
          </h1>
          {institutionVerified ? (
            <span
              className="commissioner-card__badge"
              title="Institution verified. This confirms affiliation, not resource quality."
            >
              <span aria-hidden="true">★ </span>Institution verified
            </span>
          ) : null}
          <MemberBadgeMark badge={badge} />
          {actions}
        </div>
        <dl className="profile-header__stats">
          {stats.map((stat) => (
            <div key={stat.label} className="profile-header__stat">
              <dd className="numeric">{stat.value}</dd>
              <dt>{stat.label}</dt>
            </div>
          ))}
        </dl>
        <p className="profile-header__meta">
          {institutionName ? <span>{institutionName}</span> : null}
          {institutionName && joinedAt ? <span aria-hidden="true"> · </span> : null}
          {joinedAt ? (
            <span>
              Joined <time dateTime={joinedAt}>{formatJoined(joinedAt)}</time>
            </span>
          ) : null}
        </p>
        {bio ? <p className="profile-header__bio">{bio}</p> : null}
      </div>
    </section>
  );
}
