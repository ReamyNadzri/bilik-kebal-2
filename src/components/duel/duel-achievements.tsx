"use client";

import Link from "next/link";
import type { DuelAchievement, DuelAchievements } from "@/contracts/duel";

export interface DuelAchievementsProps {
  readonly achievements: DuelAchievements;
  /** The achievement whose free request is being claimed, if any. */
  readonly claiming: string | null;
  /** The answer to the last claim, in words. */
  readonly message: { readonly text: string; readonly ok: boolean } | null;
  readonly onClaim: (id: string) => void;
}

const MONTH_NAME = new Intl.DateTimeFormat("en-MY", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const RESET_DAY = new Intl.DateTimeFormat("en-MY", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Kuala_Lumpur",
});

function monthName(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return MONTH_NAME.format(new Date(Date.UTC(year ?? 2026, (monthNumber ?? 1) - 1, 1)));
}

/** What a reward achievement offers right now, in words, with its one action. */
function RewardState({
  item,
  eligible,
  claiming,
  onClaim,
}: {
  readonly item: DuelAchievement;
  readonly eligible: boolean;
  readonly claiming: string | null;
  readonly onClaim: (id: string) => void;
}) {
  if (item.claimed) return <p className="duel-ach__reward-state">Free request claimed</p>;
  if (!item.done) return null;
  if (!eligible) {
    return (
      <p className="duel-ach__reward-state">
        <Link href="/profile/institution-verification">Verify your institution</Link> to claim the
        free request.
      </p>
    );
  }
  return (
    <button
      type="button"
      className="duel-button duel-ach__claim"
      disabled={claiming !== null}
      aria-label={`Claim the free request for ${item.title}`}
      onClick={() => onClaim(item.id)}
    >
      {claiming === item.id ? "CLAIMING…" : "CLAIM"}
    </button>
  );
}

/**
 * The month's 50 achievements, grouped by kind. Progress is the server's,
 * counted from this month's duels and practice shots; it starts again on the
 * first of the month. Three of them give an institution-verified member one
 * free request each, claimed once a month.
 */
export function DuelAchievementsSection({
  achievements,
  claiming,
  message,
  onClaim,
}: DuelAchievementsProps) {
  const { items } = achievements;
  const done = items.filter((item) => item.done).length;
  const categories = [...new Set(items.map((item) => item.category))];

  return (
    <section className="duel-ach" aria-labelledby="duel-ach-heading">
      <div className="duel-field__heading">
        <h2 className="duel-field__title" id="duel-ach-heading">
          Achievements · {monthName(achievements.month)}
        </h2>
        <span className="duel-field__aside">
          {done} of {items.length} done · resets {RESET_DAY.format(new Date(achievements.resetsAt))}
        </span>
      </div>
      <p className="duel-ach__intro">
        Every achievement counts this month&rsquo;s duels and practice only, then starts again. The
        three marked <strong>+1 free request</strong> each add a free Wanted to your account once a
        month
        {achievements.rewardEligible ? "." : ", for institution-verified hunters."}
      </p>
      {message === null ? null : message.ok ? (
        <p className="duel-ach__message" role="status">
          {message.text}
        </p>
      ) : (
        <p className="duel-notice" role="alert">
          {message.text}
        </p>
      )}

      {categories.map((category) => (
        <div key={category} className="duel-ach__group">
          <h3 className="duel-ach__category">{category.toUpperCase()}</h3>
          <ul className="duel-ach__grid">
            {items
              .filter((item) => item.category === category)
              .map((item) => (
                <li
                  key={item.id}
                  className={`duel-ach__card${item.done ? " duel-ach__card--done" : ""}${
                    item.grantsFreeRequest ? " duel-ach__card--reward" : ""
                  }`}
                >
                  <div className="duel-ach__top">
                    <span className="duel-ach__title">{item.title}</span>
                    {item.done ? (
                      <span className="duel-ach__done">
                        <span aria-hidden="true">✓ </span>Done
                      </span>
                    ) : null}
                  </div>
                  <p className="duel-ach__description">{item.description}</p>
                  {item.grantsFreeRequest ? (
                    <p className="duel-ach__reward">+1 free request</p>
                  ) : null}
                  <div className="duel-ach__progress">
                    <progress
                      max={item.target}
                      value={item.progress}
                      aria-label={`${item.title} progress`}
                    />
                    <span className="duel-ach__count">
                      {item.progress}/{item.target}
                    </span>
                  </div>
                  {item.grantsFreeRequest ? (
                    <RewardState
                      item={item}
                      eligible={achievements.rewardEligible}
                      claiming={claiming}
                      onClaim={onClaim}
                    />
                  ) : null}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
