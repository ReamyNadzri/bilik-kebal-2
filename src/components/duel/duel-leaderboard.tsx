import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { DUEL_LEADERBOARD_MIN_DUELS, type DuelLeaderboardResult } from "@/contracts/duel";
import { killDeathRatio } from "@/features/presentation/duel/duel-rules";

const PLACE = ["1st", "2nd", "3rd"] as const;

/**
 * The front page's top three duellists by all-time K/D, from 10 duels up.
 * The same members who may see the Hunters may see it.
 */
export function DuelLeaderboard({ result }: { readonly result: DuelLeaderboardResult }) {
  return (
    <aside className="duel-leaders" aria-labelledby="duel-leaders-title">
      <h3 className="duel-leaders__title" id="duel-leaders-title">
        Top guns · K/D
      </h3>
      {!result.ok ? (
        <p className="duel-leaders__note">
          {result.code === "AUTH_REQUIRED" ? (
            <>
              <Link href="/sign-in?next=/">Sign in</Link> to see the top guns.
            </>
          ) : result.code === "EMAIL_NOT_VERIFIED" ? (
            <>
              <Link href="/verify-email">Verify your email</Link> to see the top guns.
            </>
          ) : (
            "The top guns could not be loaded just now."
          )}
        </p>
      ) : result.data.length === 0 ? (
        <p className="duel-leaders__note">
          No hunter has {DUEL_LEADERBOARD_MIN_DUELS} duels yet. The top spot is open.
        </p>
      ) : (
        <ol className="duel-leaders__list">
          {result.data.map((leader, index) => (
            <li
              key={leader.publicId}
              className={`duel-leaders__item duel-leaders__item--${index + 1}`}
            >
              <span className="duel-leaders__place">{PLACE[index]}</span>
              <Avatar src={leader.avatarUrl} size={36} className="duel-leaders__avatar" />
              <Link className="duel-leaders__name" href={`/u/${leader.publicId}`} prefetch={false}>
                {leader.displayName}
              </Link>
              <span className="duel-leaders__kd">
                <span className="visually-hidden">K/D </span>
                {killDeathRatio(leader)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
