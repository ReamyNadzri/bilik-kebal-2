"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UNIVERSITY_COOKIE, type UniversityChoice } from "@/contracts/universities";

export interface UniversitySwitchProps {
  readonly choice: UniversityChoice;
  /**
   * Where to go after switching. Filters name one university's campuses and
   * courses, so a switch starts from the unfiltered page rather than keep a
   * filter the other university cannot match.
   */
  readonly resetHref: string;
}

/** Kept a year; the server reads it on the next render. */
function rememberUniversity(slug: string): void {
  document.cookie = `${UNIVERSITY_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Which university's Board, map and Hunters are shown.
 *
 * A member verified at a university sees only that one, so for them this is a
 * plain statement. Anyone else picks, and the pick is remembered in a cookie
 * the server reads on the next render; the server decides what is listed, and
 * this only records the choice.
 */
export function UniversitySwitch({ choice, resetHref }: UniversitySwitchProps) {
  const router = useRouter();
  const [picked, setPicked] = useState(choice.current.slug);
  const [pending, startTransition] = useTransition();

  if (choice.locked) {
    return (
      <p className="university-switch university-switch--locked">
        Showing <strong>{choice.current.shortName}</strong>, the university you verified with.
      </p>
    );
  }

  if (choice.options.length < 2) return null;

  function pick(slug: string) {
    setPicked(slug);
    rememberUniversity(slug);
    startTransition(() => {
      router.replace(resetHref);
      router.refresh();
    });
  }

  return (
    <fieldset className="university-switch" aria-busy={pending || undefined}>
      <legend className="university-switch__legend">University</legend>
      <div className="university-switch__options">
        {choice.options.map((option) => (
          <label className="university-switch__option" key={option.id} title={option.name}>
            <input
              type="radio"
              name="university"
              value={option.slug}
              checked={picked === option.slug}
              onChange={() => pick(option.slug)}
            />
            <span>{option.shortName}</span>
          </label>
        ))}
      </div>
      <p className="university-switch__hint">
        Once you verify with your university, you see only yours.
      </p>
    </fieldset>
  );
}
