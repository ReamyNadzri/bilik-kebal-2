"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ALL_UNIVERSITIES,
  UNIVERSITY_COOKIE,
  type UniversityChoice,
} from "@/contracts/universities";

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
 * Which university's Board, map and Hunters are shown: one, or All, the same
 * switch on every screen that lists them.
 *
 * Everyone may switch. For a member verified at a university, every other
 * university is greyed out and marked view-only: its requests can be read but
 * not backed, claimed or replied to (the server enforces that; this only
 * says so). The pick is remembered in a cookie the server reads on the next
 * render; the server decides what is listed, and this only records the choice.
 */
export function UniversitySwitch({ choice, resetHref }: UniversitySwitchProps) {
  const router = useRouter();
  const [picked, setPicked] = useState(choice.all ? ALL_UNIVERSITIES : choice.current.slug);
  const [pending, startTransition] = useTransition();

  if (choice.options.length < 2) return null;

  function pick(slug: string) {
    setPicked(slug);
    rememberUniversity(slug);
    startTransition(() => {
      router.replace(resetHref);
      router.refresh();
    });
  }

  const own = choice.own;
  const options = [
    { slug: ALL_UNIVERSITIES, label: "All", title: "Every university", viewOnly: false },
    ...choice.options.map((option) => ({
      slug: option.slug,
      label: option.shortName,
      title: option.name,
      viewOnly: own !== null && option.id !== own.id,
    })),
  ];

  return (
    <fieldset className="university-switch" aria-busy={pending || undefined}>
      <legend className="university-switch__legend">University</legend>
      <div className="university-switch__options">
        {options.map((option) => (
          <label
            className={`university-switch__option${option.viewOnly ? " university-switch__option--view-only" : ""}`}
            key={option.slug}
            title={option.viewOnly ? `${option.title}: view only` : option.title}
          >
            <input
              type="radio"
              name="university"
              value={option.slug}
              checked={picked === option.slug}
              onChange={() => pick(option.slug)}
            />
            <span>
              {option.label}
              {option.viewOnly ? <span className="visually-hidden"> (view only)</span> : null}
            </span>
          </label>
        ))}
      </div>
      <p className="university-switch__hint">
        {own !== null
          ? `You can back, claim and reply at ${own.shortName}. Other universities are view only.`
          : "Once you verify with your university, you can back, claim and reply there."}
      </p>
    </fieldset>
  );
}
