"use client";

import Link from "next/link";
import type { DuelAchievements, DuelTopic } from "@/contracts/duel";

export interface DuelAchievementsProps {
  readonly achievements: DuelAchievements;
  /** The topic whose free requests are being claimed, if any. */
  readonly claiming: string | null;
  /** The answer to the last claim, in words. */
  readonly message: { readonly text: string; readonly ok: boolean } | null;
  readonly onClaim: (topic: string) => void;
}

const MONTH_NAME = new Intl.DateTimeFormat("en-MY", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const DAY = new Intl.DateTimeFormat("en-MY", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Kuala_Lumpur",
});

function monthName(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return MONTH_NAME.format(new Date(Date.UTC(year ?? 2026, (monthNumber ?? 1) - 1, 1)));
}

/** The badge art for an achievement, numbered as in the catalogue. */
export function badgeSrc(number: number): string {
  return `/duel/badges/${String(number).padStart(2, "0")}.webp`;
}

/** What a topic's reward offers right now, in words, with its one action. */
function TopicReward({
  topic,
  credits,
  eligible,
  claiming,
  onClaim,
}: {
  readonly topic: DuelTopic;
  readonly credits: number;
  readonly eligible: boolean;
  readonly claiming: string | null;
  readonly onClaim: (topic: string) => void;
}) {
  const reward = `${credits} free requests`;
  if (topic.claimed) {
    return (
      <p className="duel-ach__topic-reward duel-ach__topic-reward--claimed">
        {reward} claimed
        {topic.expiresAt ? ` · expire ${DAY.format(new Date(topic.expiresAt))}` : ""}
      </p>
    );
  }
  if (topic.done < topic.total) {
    return (
      <p className="duel-ach__topic-reward">
        Finish all {topic.total} for {reward}
      </p>
    );
  }
  if (!eligible) {
    return (
      <p className="duel-ach__topic-reward">
        <Link href="/profile/institution-verification">Verify your institution</Link> to claim{" "}
        {reward}
      </p>
    );
  }
  return (
    <button
      type="button"
      className="duel-button duel-ach__claim"
      disabled={claiming !== null}
      aria-label={`Claim ${reward} for finishing ${topic.category}`}
      onClick={() => onClaim(topic.category)}
    >
      {claiming === topic.category ? "CLAIMING…" : `CLAIM ${credits} FREE REQUESTS`}
    </button>
  );
}

/**
 * The month's 50 achievements, in their 7 topics. Progress is the server's,
 * counted from this month's duels and practice shots; it starts again on the
 * first of the month. A badge is grey until its achievement is done. Finishing
 * every achievement of a topic gives an institution-verified member free
 * requests that expire one month after they are claimed.
 */
export function DuelAchievementsSection({
  achievements,
  claiming,
  message,
  onClaim,
}: DuelAchievementsProps) {
  const { items, topics, topicCredits } = achievements;
  const done = items.filter((item) => item.done).length;

  return (
    <section className="duel-ach" aria-labelledby="duel-ach-heading">
      <div className="duel-field__heading">
        <h2 className="duel-field__title" id="duel-ach-heading">
          Achievements · {monthName(achievements.month)}
        </h2>
        <span className="duel-field__aside">
          {done} of {items.length} done · resets {DAY.format(new Date(achievements.resetsAt))}
        </span>
      </div>
      <p className="duel-ach__intro">
        Every achievement counts this month&rsquo;s duels and practice only, then starts again.
        Finish every achievement in a topic for <strong>{topicCredits} free requests</strong>, which
        expire one month after you claim them
        {achievements.rewardEligible ? "." : ". Free requests go to institution-verified hunters."}
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

      {topics.map((topic) => {
        const headingId = `duel-topic-${topic.category.toLowerCase()}`;
        return (
          <div key={topic.category} className="duel-ach__group">
            <div className="duel-ach__topic">
              <h3 className="duel-ach__category" id={headingId}>
                {`${topic.category.toUpperCase()} · `}
                <span className="duel-ach__topic-count">
                  {topic.done}/{topic.total}
                </span>
              </h3>
              <TopicReward
                topic={topic}
                credits={topicCredits}
                eligible={achievements.rewardEligible}
                claiming={claiming}
                onClaim={onClaim}
              />
            </div>
            <ul className="duel-ach__grid" aria-labelledby={headingId}>
              {items
                .filter((item) => item.category === topic.category)
                .map((item) => (
                  <li
                    key={item.id}
                    className={`duel-ach__card${item.done ? " duel-ach__card--done" : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- a small, fixed badge */}
                    <img
                      className={`duel-ach__badge${item.done ? "" : " duel-ach__badge--locked"}`}
                      src={badgeSrc(item.number)}
                      alt=""
                      width={84}
                      height={84}
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="duel-ach__body">
                      <div className="duel-ach__top">
                        <span className="duel-ach__title">{item.title}</span>
                        {item.done ? (
                          <span className="duel-ach__done">
                            <span aria-hidden="true">✓ </span>Done
                          </span>
                        ) : null}
                      </div>
                      <p className="duel-ach__description">{item.description}</p>
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
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
