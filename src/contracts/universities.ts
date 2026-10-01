/**
 * The university a screen is showing.
 *
 * A reader browses one university or all of them at once (request,
 * 2026-10-02). A member verified at one university starts on "All", with the
 * other university's requests greyed out as view-only; anyone else starts on
 * the first university. It is a filter, not access control. RLS is unchanged, a shared
 * link to another university's Wanted still opens, and posting, backing,
 * claiming and replying are already limited to the member's own university.
 */
export interface University {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  /** What the switch and labels show: "UiTM", "UMPSA". */
  readonly shortName: string;
}

export interface UniversityChoice {
  /**
   * The university shown. With `all`, the reader's own (or the first): what
   * lists scoped to one university, like Post a Wanted's campuses, still use.
   */
  readonly current: University;
  /** Every active university, in the order the switch lists them. */
  readonly options: readonly University[];
  /** Every university at once: lists are not filtered. */
  readonly all: boolean;
  /**
   * The university the member verified with, or null. Requests of any other
   * university are view-only for them, and greyed out.
   */
  readonly own: University | null;
}

/** Remembers the reader's choice. Holds a slug, or `ALL_UNIVERSITIES`. */
export const UNIVERSITY_COOKIE = "vaultix_university";

/** The cookie value for "All". */
export const ALL_UNIVERSITIES = "all";

/** The institution a list is scoped to, or null for every university. */
export function scopedInstitutionId(choice: UniversityChoice | null): string | null {
  return choice === null || choice.all ? null : choice.current.id;
}

/**
 * The universities whose requests are view-only for this reader, by
 * institution id: every one but their own. Empty for a reader not verified
 * anywhere, who can act nowhere yet and is told so by the action itself.
 */
export function viewOnlyUniversities(
  choice: UniversityChoice | null,
): Readonly<Record<string, string>> {
  const own = choice?.own ?? null;
  if (choice === null || own === null) return {};
  return Object.fromEntries(
    choice.options
      .filter((option) => option.id !== own.id)
      .map((option) => [option.id, option.shortName]),
  );
}

/** "UiTM", or "UiTM and UMPSA" under All. */
export function universityLabel(choice: UniversityChoice): string {
  if (!choice.all) return choice.current.shortName;
  const names = choice.options.map((option) => option.shortName);
  return names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
