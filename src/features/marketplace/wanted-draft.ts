import { sen, type Sen } from "./money";
import { coursesFor, programmesFor } from "./taxonomy";
import type {
  CourseOption,
  MarketplaceTaxonomy,
  TaxonomyItem,
  WantedDraftInput,
} from "@/contracts/marketplace";

/**
 * Frontend validation for a Wanted draft.
 *
 * A pure function over the form's values, so every rule is testable without a
 * browser. It is a courtesy to the reader, never an authority: the server
 * validates the same draft again and RLS enforces who may create one at all
 * (`context/architecture.md`). Nothing here may be relaxed on the assumption
 * that the backend is stricter, and nothing may be added that the backend does
 * not also enforce.
 *
 * The limits mirror the published contract
 * (docs/integration/marketplace-http-contract.md): exactly 7, 14 or 30 days,
 * and a first contribution of 100–5,000 sen. The contribution is validated
 * here but is not part of a draft — it travels only with the publication
 * request, because a draft holds no money.
 */

/** The only durations a Wanted may be published with. */
export const DURATION_DAYS = [7, 14, 30] as const;

export type DurationDays = (typeof DURATION_DAYS)[number];

export const MIN_CONTRIBUTION_SEN = 100;
export const MAX_CONTRIBUTION_SEN = 5000;

const TITLE_MIN = 8;
const TITLE_MAX = 120;
const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 2000;
const TAG_MAX = 5;

/** What the form holds while it is being filled in: strings, as typed. */
export interface WantedDraftValues {
  readonly title: string;
  readonly campusId: string;
  readonly facultyId: string;
  readonly programmeId: string;
  readonly courseId: string;
  readonly sessionId: string;
  readonly resourceTypeId: string;
  readonly languageId: string;
  readonly tagIds: readonly string[];
  readonly description: string;
  readonly durationDays: string;
  readonly contribution: string;
  readonly policyAccepted: boolean;
}

/** A draft that passed validation, with its values narrowed and resolved. */
export interface ValidatedDraft {
  readonly title: string;
  readonly description: string;
  readonly campus: TaxonomyItem;
  readonly faculty: TaxonomyItem;
  readonly programme: TaxonomyItem;
  readonly course: CourseOption;
  readonly session: TaxonomyItem;
  readonly resourceType: TaxonomyItem;
  readonly language: TaxonomyItem;
  readonly tags: readonly TaxonomyItem[];
  readonly durationDays: DurationDays;
  readonly contributionSen: Sen;
}

export interface DraftFieldError {
  readonly fieldId: string;
  readonly message: string;
}

export interface DraftValidation {
  readonly errors: readonly DraftFieldError[];
  readonly draft: ValidatedDraft | null;
}

export function emptyDraft(): WantedDraftValues {
  return {
    title: "",
    campusId: "",
    facultyId: "",
    programmeId: "",
    courseId: "",
    sessionId: "",
    resourceTypeId: "",
    languageId: "",
    tagIds: [],
    description: "",
    durationDays: "",
    contribution: "",
    policyAccepted: false,
  };
}

function find(options: readonly TaxonomyItem[], id: string): TaxonomyItem | undefined {
  return options.find((option) => option.id === id);
}

/**
 * The body `POST`/`PUT .../drafts` accepts, built from a draft that already
 * passed validation.
 *
 * Identifiers only. A label the browser is holding is a rendering of a server
 * record, never an authority over one, and the contribution is absent because
 * a draft carries no money.
 */
export function toDraftInput(draft: ValidatedDraft): WantedDraftInput {
  return {
    campusId: draft.campus.id,
    facultyId: draft.faculty.id,
    programmeId: draft.programme.id,
    courseId: draft.course.id,
    academicSessionId: draft.session.id,
    resourceTypeId: draft.resourceType.id,
    languageId: draft.language.id,
    tagIds: draft.tags.map((tag) => tag.id),
    title: draft.title,
    description: draft.description,
    durationDays: draft.durationDays,
    policyAccepted: true,
  };
}

/**
 * Parses a Ringgit amount into integer sen without floating point.
 *
 * `Number("10.10") * 100` is 1009.9999999999999. Money is an invariant
 * (`context/architecture.md`), so the two halves are parsed as integers and
 * combined, and anything finer than a sen is refused rather than rounded —
 * rounding here would silently change what someone is charged.
 */
type AmountParse =
  | { readonly ok: true; readonly sen: number }
  | { readonly ok: false; readonly reason: "not-a-number" | "sub-sen" };

export function parseRinggitToSen(raw: string): AmountParse {
  const trimmed = raw.trim();

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, reason: "not-a-number" };
  }

  const [whole = "0", fraction = ""] = trimmed.split(".");

  if (fraction.length > 2) {
    return { ok: false, reason: "sub-sen" };
  }

  return { ok: true, sen: Number(whole) * 100 + Number(fraction.padEnd(2, "0")) };
}

/**
 * Validates every field, collecting failures rather than stopping at the
 * first. A reader fixing one problem at a time and resubmitting to find the
 * next is the worst version of this screen.
 *
 * Errors come back in the order the fields are read, so the summary at the top
 * matches the order of the form beneath it.
 */
export function validateDraft(
  values: WantedDraftValues,
  taxonomy: MarketplaceTaxonomy,
): DraftValidation {
  const errors: DraftFieldError[] = [];
  const fail = (fieldId: string, message: string) => errors.push({ fieldId, message });

  const title = values.title.trim();
  if (title === "") {
    fail("wanted-title", "Enter a title for your request.");
  } else if (title.length < TITLE_MIN) {
    fail("wanted-title", `The title must be at least ${TITLE_MIN} characters.`);
  } else if (title.length > TITLE_MAX) {
    fail("wanted-title", `The title must be ${TITLE_MAX} characters or fewer.`);
  }

  const campus = find(taxonomy.campuses, values.campusId);
  if (campus === undefined) {
    fail("wanted-campus", "Choose the campus this request is for.");
  }

  const faculty = find(taxonomy.faculties, values.facultyId);
  if (faculty === undefined) {
    fail("wanted-faculty", "Choose the faculty or college this course belongs to.");
  }

  const programme = programmesFor(taxonomy, values.facultyId).find(
    (option) => option.id === values.programmeId,
  );
  if (programme === undefined) {
    fail(
      "wanted-programme",
      faculty === undefined || values.programmeId === ""
        ? "Choose the programme this course belongs to."
        : "That programme does not belong to the chosen faculty.",
    );
  }

  const course = coursesFor(taxonomy, values.programmeId).find(
    (option) => option.id === values.courseId,
  );
  if (course === undefined) {
    fail(
      "wanted-course",
      programme === undefined || values.courseId === ""
        ? "Choose the course this resource is for."
        : "That course does not belong to the chosen programme.",
    );
  }

  const session = find(taxonomy.academicSessions, values.sessionId);
  if (session === undefined) {
    fail("wanted-session", "Choose the academic session this request covers.");
  }

  const resourceType = find(taxonomy.resourceTypes, values.resourceTypeId);
  if (resourceType === undefined) {
    fail("wanted-resource-type", "Choose the kind of resource you need.");
  }

  const language = find(taxonomy.languages, values.languageId);
  if (language === undefined) {
    fail("wanted-language", "Choose the language the resource should be in.");
  }

  const tags = values.tagIds.map((id) => find(taxonomy.tags, id));
  if (tags.some((tag) => tag === undefined)) {
    fail("wanted-tags", "Choose tags from the list.");
  } else if (values.tagIds.length > TAG_MAX) {
    fail("wanted-tags", `Choose no more than ${TAG_MAX} tags.`);
  }

  const description = values.description.trim();
  if (description === "") {
    fail("wanted-description", "Describe what the resource needs to cover.");
  } else if (description.length < DESCRIPTION_MIN) {
    fail("wanted-description", `The description must be at least ${DESCRIPTION_MIN} characters.`);
  } else if (description.length > DESCRIPTION_MAX) {
    fail("wanted-description", "The description must be 2,000 characters or fewer.");
  }

  const durationDays = DURATION_DAYS.find((days) => String(days) === values.durationDays);
  if (durationDays === undefined) {
    fail("wanted-duration", "Choose how long the request stays open: 7, 14 or 30 days.");
  }

  const amount = parseRinggitToSen(values.contribution);
  let contributionSen: number | null = null;

  if (values.contribution.trim() === "") {
    fail("wanted-contribution", "Enter your first contribution.");
  } else if (!amount.ok) {
    fail(
      "wanted-contribution",
      amount.reason === "sub-sen"
        ? "Enter an amount in Ringgit and sen, for example 10.50."
        : "Enter your contribution as an amount, for example 10.",
    );
  } else if (amount.sen < MIN_CONTRIBUTION_SEN || amount.sen > MAX_CONTRIBUTION_SEN) {
    fail("wanted-contribution", "Each contribution must be between RM1 and RM50.");
  } else {
    contributionSen = amount.sen;
  }

  if (!values.policyAccepted) {
    fail("wanted-policy", "Accept the content policy before continuing.");
  }

  if (
    errors.length > 0 ||
    campus === undefined ||
    faculty === undefined ||
    programme === undefined ||
    course === undefined ||
    session === undefined ||
    resourceType === undefined ||
    language === undefined ||
    durationDays === undefined ||
    contributionSen === null
  ) {
    return { errors, draft: null };
  }

  return {
    errors,
    draft: {
      title,
      description,
      campus,
      faculty,
      programme,
      course,
      session,
      resourceType,
      language,
      tags: tags.filter((tag): tag is TaxonomyItem => tag !== undefined),
      durationDays,
      contributionSen: sen(contributionSen),
    },
  };
}
