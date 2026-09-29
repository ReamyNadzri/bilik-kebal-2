/**
 * The university a screen is showing.
 *
 * Each university is browsed on its own (migration 202610150005): a member
 * verified at one sees that one's Board, map, Hunters and homepage; anyone
 * else chooses. It is a filter, not access control. RLS is unchanged, a shared
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
  readonly current: University;
  /** Every active university, in the order the switch lists them. */
  readonly options: readonly University[];
  /** A member verified at `current`: they see only their own and cannot switch. */
  readonly locked: boolean;
}

/** Remembers the choice of a reader not yet verified. Holds a slug only. */
export const UNIVERSITY_COOKIE = "vaultix_university";
