"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BountyPlate } from "./bounty-plate";
import { ErrorSummary } from "./error-summary";
import { TaxonomyRequestDialog } from "./taxonomy-request-dialog";
import { UiStatus, type UiStatusKind } from "./ui-status";
import { WantedCard } from "./wanted-card";
import type {
  CourseOption,
  MarketplaceOperationCode,
  MarketplaceTaxonomy,
  TaxonomyItem,
  WantedDuplicateSuggestion,
} from "@/contracts/marketplace";
import type { MoneyOperationCode } from "@/contracts/money";
import {
  checkWantedDuplicates,
  createDraftContributionBill,
  publishCommunityWanted,
  publishFreeWanted,
  saveWantedDraft,
} from "@/features/marketplace/draft-operations";
import { POSTING_TERMS, TERMS_STATUS, TERMS_VERSION } from "@/features/legal/terms";
import {
  messageFor,
  toDraftFieldErrors,
  type DraftFieldError,
} from "@/features/marketplace/marketplace-messages";
import { formatRinggit } from "@/features/marketplace/money";
import { courseLabel, coursesFor, programmesFor } from "@/features/marketplace/taxonomy";
import {
  MAX_DURATION_DAYS,
  MIN_DURATION_DAYS,
  emptyDraft,
  toCommunityInput,
  toDraftInput,
  validateDraft,
  type ValidatedDraft,
  type WantedDraftValues,
} from "@/features/marketplace/wanted-draft";
import { MAX_CONTRIBUTION_SEN, MIN_CONTRIBUTION_SEN } from "@/features/marketplace/wanted-draft";
import { sen } from "@/features/marketplace/money";
import type { FreeRequestAllowance, WantedKind } from "@/contracts/marketplace";
import type { TaxonomyRequestCategory } from "@/contracts/taxonomy-requests";

/**
 * `live` persists through the published Phase 3A operations. `preview` is the
 * development harness: it validates and previews only, creates nothing, and
 * says so.
 */
export type WantedDraftMode = "live" | "preview";

export interface WantedDraftWorkspaceProps {
  readonly taxonomy: MarketplaceTaxonomy;
  readonly mode?: WantedDraftMode;
}

/**
 * The platform fee rate the backend snapshots at publication, in basis points.
 * Shown so a Commissioner knows what is deducted before they part with money;
 * the authoritative rate travels with the published Wanted.
 */
const FEE_RATE_BASIS_POINTS = 1000;

const DUPLICATE_REASON: Record<WantedDuplicateSuggestion["reasons"][number], string> = {
  same_course: "Same course",
  same_resource_type: "Same resource type",
  same_session: "Same academic session",
  similar_title: "Similar title",
};

/** What the form shows above itself: field errors, or a refusal, never both. */
type Feedback =
  | { readonly kind: "none" }
  | { readonly kind: "fields"; readonly errors: readonly DraftFieldError[] }
  | {
      readonly kind: "refusal";
      readonly status: UiStatusKind;
      readonly heading: string;
      readonly message: string;
      readonly action?: ReactNode;
    };

interface ReviewState {
  readonly draft: ValidatedDraft;
  readonly suggestions: readonly WantedDuplicateSuggestion[];
  /** The server's one-use duplicate-check token. Absent in the preview harness. */
  readonly token: string | null;
  /** Reference instant for the relative times on suggestion cards. */
  readonly now: string;
}

/** What came back from asking to publish. None of these is a payment. */
type Outcome =
  | { readonly kind: "none" }
  | { readonly kind: "refused"; readonly heading: string; readonly message: string }
  | { readonly kind: "recheck"; readonly message: string }
  | { readonly kind: "awaiting-payment"; readonly paymentUrl?: string }
  | { readonly kind: "published"; readonly wantedId: string; readonly free: boolean };

const KIND_CHOICES: readonly {
  readonly kind: WantedKind;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    kind: "academic",
    label: "Academic resource",
    description: "Notes, past papers, worked answers. Hunters submit a file; a bounty is optional.",
  },
  {
    kind: "missing_item",
    label: "Missing item",
    description:
      "Something you lost on campus. People reply if they have seen it. Free, or with a reward.",
  },
  {
    kind: "discussion",
    label: "Discussion",
    description:
      "A question for your campus. Classmates reply in writing. Free, or with a bounty for the best answer.",
  },
];

/** The "What you need" section follows the kind of request being written. */
const NEED_COPY: Record<
  WantedKind,
  {
    readonly heading: string;
    readonly titleHint: string;
    readonly descriptionLabel: string;
    readonly descriptionHint: string;
  }
> = {
  academic: {
    heading: "What you need",
    titleHint: "Name the resource the way a classmate would search for it.",
    descriptionLabel: "What the resource needs to cover",
    descriptionHint:
      "Chapters, topics, and whether working or diagrams matter. Hunters answer what you ask for.",
  },
  missing_item: {
    heading: "What you lost",
    titleHint: "Name the item so people recognise it, for example “Blue Hydro Flask bottle”.",
    descriptionLabel: "Describe the item",
    descriptionHint:
      "Colour, brand, markings and when you last had it. Do not include phone numbers: people reply on the request.",
  },
  discussion: {
    heading: "What you want to discuss",
    titleHint: "Ask the question the way you would say it to a classmate.",
    descriptionLabel: "Your question or topic",
    descriptionHint:
      "Give enough context for a useful answer. Classmates reply in writing on the request.",
  },
};

type Step = "idle" | "saving" | "checking" | "publishing";

interface Refusal {
  readonly status: UiStatusKind;
  readonly heading: string;
  readonly action?: ReactNode;
}

/**
 * How each refusal is presented.
 *
 * The decision is never made here. The operation and RLS decide; this only
 * chooses the wording and, where one exists, the route that resolves it. A
 * code with no route offers no action rather than inventing a remedy.
 */
function refusalFor(code: MarketplaceOperationCode | MoneyOperationCode): Refusal {
  switch (code) {
    case "AUTH_REQUIRED":
      return {
        status: "restricted",
        heading: "Sign in to continue",
        action: <Link href="/sign-in">Sign in</Link>,
      };
    case "EMAIL_NOT_VERIFIED":
      return {
        status: "restricted",
        heading: "Verify your email first",
        action: <Link href="/verify-email">Go to email verification</Link>,
      };
    case "INSTITUTION_VERIFICATION_REQUIRED":
      return {
        status: "restricted",
        heading: "Verify your institution to post a Wanted",
        action: <Link href="/profile/institution-verification">Verify your institution</Link>,
      };
    case "ACCOUNT_RESTRICTED":
      return {
        status: "restricted",
        heading: "This account cannot post a Wanted",
        action: <Link href="/profile">Open your profile</Link>,
      };
    case "NOT_AUTHORIZED":
      return { status: "restricted", heading: "That action is not available to this account" };
    case "FREE_LIMIT_REACHED":
      return {
        status: "restricted",
        heading: "You have used all your free requests",
        action: <Link href="/profile#reward-code">Redeem a reward code</Link>,
      };
    case "PAYMENT_DISABLED":
    case "PAYMENT_UNAVAILABLE":
      return { status: "offline", heading: "Paid requests are not available yet" };
    case "DRAFT_NOT_FOUND":
      return { status: "expired", heading: "That draft is no longer on your account" };
    case "DRAFT_NOT_EDITABLE":
      return { status: "expired", heading: "This request can no longer be edited" };
    case "PAYMENT_PROVIDER_REJECTED":
    case "PAYMENT_CALLBACK_INVALID":
    case "PAYMENT_CALLBACK_REPLAY":
    case "MONEY_UNAVAILABLE":
      return { status: "offline", heading: "Payment could not be prepared" };
    default:
      return { status: "offline", heading: "Your draft could not be saved" };
  }
}

interface SelectFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly value: string;
  readonly options: readonly {
    readonly id: string;
    readonly label: string;
    readonly disabled?: boolean;
  }[];
  readonly placeholder: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
  /** Optional fields say so and let the placeholder stand as an answer. */
  readonly optional?: boolean;
  /** A "not listed?" action under the field. */
  readonly request?: ReactNode;
}

function SelectField({
  id,
  label,
  hint,
  value,
  options,
  placeholder,
  error,
  onChange,
  optional = false,
  request,
}: SelectFieldProps) {
  const hintId = hint === undefined ? undefined : `${id}-hint`;
  const errorId = error === undefined ? undefined : `${id}-error`;
  const describedBy = [hintId, errorId].filter((entry) => entry !== undefined).join(" ");

  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        {label}
        <span className="form-field__required">{optional ? " (optional)" : " (required)"}</span>
      </label>

      {hint === undefined ? null : (
        <p className="form-field__hint" id={hintId}>
          {hint}
        </p>
      )}

      {error === undefined ? null : (
        <p className="form-field__error" id={errorId}>
          {error}
        </p>
      )}

      <select
        className="form-field__input"
        id={id}
        value={value}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy === "" ? undefined : describedBy}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {request === undefined ? null : <p className="form-field__request">{request}</p>}
    </div>
  );
}

function SummaryRow({ term, children }: { readonly term: string; readonly children: string }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

/**
 * The Wanted creation workspace: an intake sheet, then a review sheet.
 *
 * In `live` mode the draft is persisted through the published Phase 3A
 * operations (docs/integration/marketplace-http-contract.md): review saves the
 * draft and runs the server's duplicate check, and the review sheet's one
 * action asks the server to prepare payment, carrying the opaque token the
 * check issued.
 *
 * Nothing on this screen may report a payment, a publication or an open
 * Wanted. Phase 3A installs no adapter that could produce one: with payments
 * disabled the operation refuses, and only a verified provider callback ever
 * opens a Wanted (context/architecture.md). Every refusal therefore states
 * what did not happen to the reader's money.
 *
 * Validation here is a courtesy to the reader. The server validates the same
 * draft again, checks the taxonomy hierarchy against the caller's verified
 * institution, and RLS decides who may create one; this component decides no
 * authority.
 *
 * Values live in state and are never cleared by a failure, so a refusal from
 * any step returns the reader to a form they do not have to fill in again.
 */
export function WantedDraftWorkspace({ taxonomy, mode = "live" }: WantedDraftWorkspaceProps) {
  const [values, setValues] = useState<WantedDraftValues>(emptyDraft);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "none" });
  const [review, setReview] = useState<ReviewState | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "none" });
  const [step, setStep] = useState<Step>("idle");
  const [announcement, setAnnouncement] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<FreeRequestAllowance | null>(null);
  const [entryRequest, setEntryRequest] = useState<TaxonomyRequestCategory | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (feedback.kind === "fields" && feedback.errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [feedback]);

  // Free requests left (3 for life, plus reward codes). Advisory: the
  // database enforces the limit when the request is posted.
  useEffect(() => {
    if (mode !== "live") return;
    let cancelled = false;
    fetch("/api/marketplace/allowance", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { ok: boolean; data?: FreeRequestAllowance }) => {
        if (!cancelled && body.ok && body.data) setAllowance(body.data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const busy = step !== "idle";

  const errorFor = (fieldId: string): string | undefined =>
    feedback.kind === "fields"
      ? feedback.errors.find((error) => error.fieldId === fieldId)?.message
      : undefined;

  function update(patch: Partial<WantedDraftValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  /**
   * Changing a faculty invalidates the programme under it, and changing a
   * programme invalidates the course. Clearing them is the honest behaviour:
   * the server enforces the same hierarchy, so a stale pair would be refused
   * on submission anyway.
   */
  function chooseFaculty(facultyId: string) {
    update({ facultyId, programmeId: "", courseId: "" });
  }

  function chooseProgramme(programmeId: string) {
    update({ programmeId, courseId: "" });
  }

  function toggleTag(tagId: string, checked: boolean) {
    update({
      tagIds: checked
        ? [...values.tagIds, tagId]
        : values.tagIds.filter((current) => current !== tagId),
    });
  }

  /** Returns to the form carrying a refusal the reader can act on. */
  function refuse(
    code: MarketplaceOperationCode | MoneyOperationCode,
    message: string | undefined,
  ) {
    const { status, heading, action } = refusalFor(code);

    setReview(null);
    setOutcome({ kind: "none" });
    setAnnouncement("");
    setFeedback({ kind: "refusal", status, heading, message: messageFor(code, message), action });
  }

  /** Returns to the form with the server's own field errors against its controls. */
  function refuseFields(errors: readonly DraftFieldError[]) {
    setReview(null);
    setOutcome({ kind: "none" });
    setAnnouncement("");
    setFeedback({ kind: "fields", errors });
  }

  /**
   * Runs the server's duplicate check for a saved draft and opens the review
   * sheet with the token it issued.
   *
   * A failure here leaves the draft saved, and says so: telling someone their
   * work is gone when it is not would send them to type it again.
   */
  async function runDuplicateCheck(id: string, draft: ValidatedDraft): Promise<void> {
    setStep("checking");
    setAnnouncement("Draft saved. Checking for similar requests.");

    const result = await checkWantedDuplicates(id);

    if (!result.ok) {
      // The draft is already saved, so the framing stays "the check failed",
      // never "your work is gone". Where the refusal has a route that resolves
      // it, that route is still offered.
      const { action } = refusalFor(result.code);

      setReview(null);
      setOutcome({ kind: "none" });
      setAnnouncement("");
      setFeedback({
        kind: "refusal",
        status: "error",
        heading: "The check for similar requests did not run",
        message: `Your draft is saved and still editable, and nothing has been paid. ${messageFor(
          result.code,
          result.message,
        )}`,
        ...(action === undefined ? {} : { action }),
      });
      return;
    }

    setFeedback({ kind: "none" });
    setOutcome({ kind: "none" });
    setAnnouncement("Draft saved. Review your request before continuing.");
    setReview({
      draft,
      suggestions: result.data.suggestions,
      token: result.data.token,
      now: new Date().toISOString(),
    });
  }

  async function onReview() {
    if (busyRef.current) {
      return;
    }

    const result = validateDraft(values, taxonomy);

    if (result.community !== null) {
      await onPostCommunity(result.community);
      return;
    }

    if (result.draft === null) {
      refuseFields(result.errors);
      return;
    }

    /**
     * The harness has no session, so it persists nothing and fabricates no
     * draft, token, suggestion or payment. It previews the sheet and says so.
     */
    if (mode === "preview") {
      setFeedback({ kind: "none" });
      setOutcome({ kind: "none" });
      setReview({
        draft: result.draft,
        suggestions: [],
        token: null,
        now: new Date().toISOString(),
      });
      return;
    }

    busyRef.current = true;

    try {
      setFeedback({ kind: "none" });
      setStep("saving");
      setAnnouncement("Saving your draft.");

      const saved = await saveWantedDraft(toDraftInput(result.draft), draftId);

      if (!saved.ok) {
        const fields = toDraftFieldErrors(saved.fieldErrors);

        if (fields.length > 0) {
          refuseFields(fields);
        } else {
          refuse(saved.code, saved.message);
        }
        return;
      }

      setDraftId(saved.data.id);
      await runDuplicateCheck(saved.data.id, result.draft);
    } finally {
      busyRef.current = false;
      setStep("idle");
    }
  }

  /**
   * Missing items and discussions open in one step: no draft, no duplicate
   * check and no payment, because they carry no bounty and no file.
   */
  async function onPostCommunity(
    wanted: NonNullable<ReturnType<typeof validateDraft>["community"]>,
  ) {
    if (mode === "preview") {
      setFeedback({
        kind: "refusal",
        status: "empty",
        heading: "Preview only: nothing was posted",
        message:
          "This development preview has no account, so it saves nothing. The real screen posts this request straight to the Board.",
      });
      return;
    }
    busyRef.current = true;
    try {
      setFeedback({ kind: "none" });
      setStep("publishing");
      setAnnouncement("Posting your request.");
      const posted = await publishCommunityWanted(toCommunityInput(wanted));
      setAnnouncement("");
      if (!posted.ok) {
        const fields = toDraftFieldErrors(posted.fieldErrors);
        if (fields.length > 0) refuseFields(fields);
        else refuse(posted.code, posted.message);
        return;
      }
      setOutcome({ kind: "published", wantedId: posted.data.wantedId, free: true });
    } finally {
      busyRef.current = false;
      setStep("idle");
    }
  }

  /** Opens the checked draft with no bounty. Nothing is charged. */
  async function onPublishFree() {
    if (busyRef.current || review === null || review.token === null || draftId === null) {
      return;
    }
    busyRef.current = true;
    try {
      setStep("publishing");
      setAnnouncement("Posting your free request.");
      const result = await publishFreeWanted(draftId, review.token);
      setAnnouncement("");
      if (result.ok) {
        setReview(null);
        setOutcome({ kind: "published", wantedId: result.data.wantedId, free: true });
        return;
      }
      if (result.code === "DUPLICATE_CHECK_REQUIRED" || result.code === "DUPLICATE_CHECK_EXPIRED") {
        setOutcome({ kind: "recheck", message: messageFor(result.code, result.message) });
        return;
      }
      refuse(result.code, result.message);
    } finally {
      busyRef.current = false;
      setStep("idle");
    }
  }

  /** Runs the check again after the server refused a stale or spent token. */
  async function onCheckAgain() {
    if (busyRef.current || draftId === null || review === null) {
      return;
    }

    busyRef.current = true;

    try {
      await runDuplicateCheck(draftId, review.draft);
    } finally {
      busyRef.current = false;
      setStep("idle");
    }
  }

  /**
   * Asks the server to prepare publication.
   *
   * Never retried automatically: issuing a duplicate-check token is
   * deliberately not idempotent, and a silent retry around money would be a
   * second request the reader did not make.
   */
  async function onContinueToPayment() {
    if (
      busyRef.current ||
      review === null ||
      review.token === null ||
      draftId === null ||
      review.draft.contributionSen === null
    ) {
      return;
    }
    const contributionSen = review.draft.contributionSen;

    busyRef.current = true;

    try {
      setStep("publishing");
      setAnnouncement("Asking to prepare payment.");

      const result = await createDraftContributionBill(draftId, review.token, contributionSen);

      setAnnouncement("");

      if (result.ok) {
        // Awaiting payment is not a payment. No Wanted is open.
        setOutcome({ kind: "awaiting-payment", paymentUrl: result.data.paymentUrl });
        if (typeof window !== "undefined" && result.data.paymentUrl) {
          try {
            window.location.href = result.data.paymentUrl;
          } catch {
            // Ignored in non-navigable test runners
          }
        }
        return;
      }

      if (result.code === "PAYMENT_DISABLED" || result.code === "PAYMENT_UNAVAILABLE") {
        setOutcome({
          kind: "refused",
          heading:
            result.code === "PAYMENT_DISABLED"
              ? "Payments are switched off"
              : "Payment could not be prepared",
          message: messageFor(result.code, result.message),
        });
        return;
      }

      if (result.code === "DUPLICATE_CHECK_REQUIRED" || result.code === "DUPLICATE_CHECK_EXPIRED") {
        setOutcome({ kind: "recheck", message: messageFor(result.code, result.message) });
        return;
      }

      if (result.code === "AMOUNT_OUT_OF_RANGE") {
        refuseFields([
          { fieldId: "wanted-contribution", message: messageFor(result.code, result.message) },
        ]);
        return;
      }

      const fields = toDraftFieldErrors(result.fieldErrors);

      if (fields.length > 0) {
        refuseFields(fields);
        return;
      }

      refuse(result.code, result.message);
    } finally {
      busyRef.current = false;
      setStep("idle");
    }
  }

  function backToEdit() {
    // The token belongs to the draft as it was checked. Editing invalidates
    // it server-side, so it is dropped here rather than carried and refused.
    setReview(null);
    setOutcome({ kind: "none" });
    setAnnouncement("");
  }

  const announcer = (
    <p className="visually-hidden" data-testid="draft-announcer" aria-live="polite" role="status">
      {announcement}
    </p>
  );

  if (outcome.kind === "published") {
    return (
      <div className="draft-form">
        {announcer}
        <UiStatus
          kind="success"
          heading="Your request is on the Board"
          message={
            outcome.free
              ? "It was posted free: nothing was charged and no bounty is attached. You will be notified when someone responds."
              : "Your request is open."
          }
          action={
            <span className="dialog__actions">
              <Link className="button button--primary" href={`/wanted/${outcome.wantedId}`}>
                View your request
              </Link>
              <Link className="button button--quiet" href="/board">
                Go to the Board
              </Link>
            </span>
          }
        />
      </div>
    );
  }

  if (review !== null) {
    const { draft } = review;
    const isFree = draft.contributionSen === null;

    return (
      <div className="draft-review">
        {announcer}

        <h2>Review your request</h2>

        <div className="draft-review__panels">
          <section className="draft-review__case">
            <h3 className="draft-review__title">{draft.title}</h3>
            <p className="draft-review__description">{draft.description}</p>

            <dl
              className="index-grid draft-review__summary"
              role="group"
              aria-label="Request summary"
            >
              <SummaryRow term="Campus">{draft.campus.label}</SummaryRow>
              <SummaryRow term="Faculty">{draft.faculty.label}</SummaryRow>
              <SummaryRow term="Programme">{draft.programme.label}</SummaryRow>
              <SummaryRow term="Course">{courseLabel(draft.course)}</SummaryRow>
              <SummaryRow term="Session">{draft.session?.label ?? "Any session"}</SummaryRow>
              <SummaryRow term="Resource">{draft.resourceType.label}</SummaryRow>
              <SummaryRow term="Language">{draft.language.label}</SummaryRow>
              <SummaryRow term="Open for">{`${draft.durationDays} days`}</SummaryRow>
            </dl>

            {draft.tags.length === 0 ? null : (
              <ul className="tag-row" aria-label="Tags">
                {draft.tags.map((tag: TaxonomyItem) => (
                  <li className="tag-row__tag" key={tag.id}>
                    {tag.label}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="draft-review__ledger" aria-label="Money and policy">
            <div className="ledger-panel">
              {isFree ? (
                <>
                  <p className="free-plate">Free request</p>
                  <p className="ledger-panel__backers">
                    No bounty, no payment and no fee. You receive the resource a Sheriff approves.
                  </p>
                </>
              ) : (
                <>
                  <BountyPlate
                    amountSen={draft.contributionSen ?? sen(0)}
                    label="Your first contribution"
                    size="large"
                  />
                  <p className="ledger-panel__backers">Starts the bounty</p>
                </>
              )}
            </div>

            <div className="ledger-panel" hidden={isFree}>
              <h3 className="ledger-panel__heading">Fee and access</h3>
              <p className="ledger-panel__body">
                A {FEE_RATE_BASIS_POINTS / 100}% platform fee is taken from the bounty when a claim
                is approved. The rate, the duration and the content policy version are all
                snapshotted when the request is published, and do not change afterwards.
              </p>
              <p className="ledger-panel__body">
                The payment provider adds its own charge to your checkout total. You cover it on top
                of your contribution, so the bounty rises by the full amount you contribute.
              </p>
              <p className="ledger-panel__body">
                Access basis: contributors only. Everyone whose contribution is confirmed by the
                payment provider gains access once a Sheriff approves a claim. A free release is
                possible later only if the Hunter opts in and a Sheriff confirms the sharing rights.
              </p>
            </div>
          </aside>
        </div>

        <section className="draft-review__duplicates">
          <h3>Before you continue</h3>
          {review.suggestions.length === 0 ? (
            <p>
              No published request looks like yours.{" "}
              {review.token === null
                ? "In this preview nothing was checked; the real screen asks the server."
                : "The server ran this check on your saved draft."}
            </p>
          ) : (
            <>
              <p>
                These requests already look similar. Backing one builds a single larger bounty
                instead of splitting your class across two. This is advisory and does not stop you
                from continuing.
              </p>
              <ul className="wanted-grid" aria-label="Requests that already look similar">
                {review.suggestions.map((suggestion) => (
                  <li key={suggestion.wanted.id}>
                    <WantedCard wanted={suggestion.wanted} now={review.now} />
                    <p className="draft-review__reasons">
                      Why this matched:{" "}
                      {suggestion.reasons.map((reason) => DUPLICATE_REASON[reason]).join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="draft-review__outcome">
          <h3>What happens next</h3>

          {mode === "preview" ? (
            <>
              <p className="policy-note">
                No draft, duplicate check, contribution or payment has been created. This is the
                development preview of the sheet, rendered without an account, so it saves nothing
                and asks the server for nothing.
              </p>
              <p>
                <button className="button button--primary" type="button" onClick={backToEdit}>
                  Back to edit
                </button>
              </p>
            </>
          ) : (
            <>
              {outcome.kind === "refused" ? (
                <section className="ui-status ui-status--offline" role="alert">
                  <p className="ui-status__label">Unavailable</p>
                  <h4 className="ui-status__heading">{outcome.heading}</h4>
                  <p className="ui-status__message">{outcome.message}</p>
                  <p className="ui-status__message">
                    You have not been charged, no payment was started, and no Wanted has been
                    opened. Your draft is saved and still editable.
                  </p>
                </section>
              ) : null}

              {outcome.kind === "recheck" ? (
                <section className="ui-status ui-status--expired" role="status">
                  <p className="ui-status__label">Expired</p>
                  <h4 className="ui-status__heading">Check for similar requests again</h4>
                  <p className="ui-status__message">{outcome.message}</p>
                  <p className="ui-status__message">
                    Nothing has been paid and your draft is saved. The check is repeated against the
                    draft as it stands now.
                  </p>
                  <p className="ui-status__action">
                    <button
                      className="button button--secondary"
                      type="button"
                      aria-disabled={busy ? true : undefined}
                      onClick={onCheckAgain}
                    >
                      Check again
                    </button>
                  </p>
                </section>
              ) : null}

              {outcome.kind === "awaiting-payment" ? (
                <section className="ui-status ui-status--expired" role="status">
                  <p className="ui-status__label">Awaiting payment</p>
                  <h4 className="ui-status__heading">Your draft is waiting for payment</h4>
                  <p className="ui-status__message">
                    No payment has been taken and no Wanted has been opened. A request appears on
                    the Board only after the payment provider confirms your first contribution to
                    this site directly — never from a redirect back to it.
                  </p>
                  {outcome.paymentUrl ? (
                    <p className="ui-status__action">
                      <a
                        className="button button--primary"
                        href={outcome.paymentUrl}
                        rel="noopener noreferrer"
                      >
                        Proceed to ToyyibPay
                      </a>
                    </p>
                  ) : null}
                </section>
              ) : null}

              <p className="policy-note">
                {isFree
                  ? "Posting opens your request on the Board straight away. A Sheriff reviews every claim before any resource is released."
                  : "Your draft is private to you until a confirmed first contribution opens it. A Sheriff reviews every claim before any resource is released or any bounty is released to a Hunter."}
              </p>

              <div className="draft-form__actions">
                {outcome.kind === "recheck" ? null : (
                  <button
                    className="button button--primary"
                    type="button"
                    aria-disabled={busy ? true : undefined}
                    onClick={isFree ? onPublishFree : onContinueToPayment}
                  >
                    {step === "publishing"
                      ? isFree
                        ? "Post free request (working…)"
                        : "Continue to payment (working…)"
                      : isFree || draft.contributionSen === null
                        ? "Post free request"
                        : `Continue to payment of ${formatRinggit(draft.contributionSen)}`}
                  </button>
                )}
                <button className="button button--quiet" type="button" onClick={backToEdit}>
                  Back to edit
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    );
  }

  const programmes = programmesFor(taxonomy, values.facultyId === "" ? null : values.facultyId);
  const courses = coursesFor(taxonomy, values.programmeId === "" ? null : values.programmeId);
  const isAcademic = values.kind === "academic";
  const need = NEED_COPY[values.kind];
  const noFreeLeft = allowance !== null && allowance.remaining <= 0;
  const askSheriff = (category: TaxonomyRequestCategory, what: string) => (
    <>
      Not listed?{" "}
      <button type="button" className="link-button" onClick={() => setEntryRequest(category)}>
        Ask a Sheriff to add {what}
      </button>
    </>
  );
  const durationError = errorFor("wanted-duration");
  const tagError = errorFor("wanted-tags");
  const policyError = errorFor("wanted-policy");

  return (
    <div className="draft-form">
      {announcer}

      {feedback.kind === "fields" ? (
        <ErrorSummary errors={[...feedback.errors]} ref={summaryRef} />
      ) : null}

      {feedback.kind === "refusal" ? (
        <UiStatus
          kind={feedback.status}
          heading={feedback.heading}
          message={feedback.message}
          action={feedback.action}
        />
      ) : null}

      <p className="draft-form__provenance">
        {mode === "preview"
          ? "These options are development fixtures, not a reviewed institutional catalogue. The published taxonomy replaces them on the real screen."
          : "These options come from reviewed institutional records for your verified institution. If something is missing, it has not been published yet."}
      </p>

      <section className="draft-form__section">
        <h2 className="draft-form__section-heading">What kind of request?</h2>
        <fieldset className="draft-form__fieldset" id="wanted-kind">
          <legend className="visually-hidden">Request type</legend>
          <div className="kind-choices">
            {KIND_CHOICES.map((choice) => (
              <label className="kind-choice" key={choice.kind}>
                <input
                  type="radio"
                  name="wanted-kind"
                  value={choice.kind}
                  checked={values.kind === choice.kind}
                  onChange={() => update({ kind: choice.kind })}
                />
                <span className="kind-choice__label">{choice.label}</span>
                <span className="kind-choice__description">{choice.description}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="draft-form__section">
        <h2 className="draft-form__section-heading">{need.heading}</h2>

        <div className="form-field">
          <label className="form-field__label" htmlFor="wanted-title">
            Title
            <span className="form-field__required"> (required)</span>
          </label>
          <p className="form-field__hint" id="wanted-title-hint">
            {need.titleHint}
          </p>
          {errorFor("wanted-title") === undefined ? null : (
            <p className="form-field__error" id="wanted-title-error">
              {errorFor("wanted-title")}
            </p>
          )}
          <input
            className="form-field__input"
            id="wanted-title"
            type="text"
            value={values.title}
            maxLength={120}
            aria-invalid={errorFor("wanted-title") === undefined ? undefined : true}
            aria-describedby={
              errorFor("wanted-title") === undefined
                ? "wanted-title-hint"
                : "wanted-title-hint wanted-title-error"
            }
            onChange={(event) => update({ title: event.target.value })}
          />
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor="wanted-description">
            {need.descriptionLabel}
            <span className="form-field__required"> (required)</span>
          </label>
          <p className="form-field__hint" id="wanted-description-hint">
            {need.descriptionHint}
          </p>
          {errorFor("wanted-description") === undefined ? null : (
            <p className="form-field__error" id="wanted-description-error">
              {errorFor("wanted-description")}
            </p>
          )}
          <textarea
            className="form-field__input draft-form__textarea"
            id="wanted-description"
            rows={5}
            value={values.description}
            maxLength={2000}
            aria-invalid={errorFor("wanted-description") === undefined ? undefined : true}
            aria-describedby={
              errorFor("wanted-description") === undefined
                ? "wanted-description-hint"
                : "wanted-description-hint wanted-description-error"
            }
            onChange={(event) => update({ description: event.target.value })}
          />
        </div>
      </section>

      <section className="draft-form__section">
        <h2 className="draft-form__section-heading">Where it belongs</h2>

        <div className="draft-form__grid">
          <SelectField
            id="wanted-campus"
            label="Campus"
            hint="Campuses marked coming soon are not open for requests yet."
            value={values.campusId}
            options={taxonomy.campuses.map((campus) => ({
              id: campus.id,
              label: campus.regionOpen ? campus.label : `${campus.label} (coming soon)`,
              disabled: !campus.regionOpen,
            }))}
            placeholder="Choose a campus"
            error={errorFor("wanted-campus")}
            onChange={(campusId) => update({ campusId })}
            request={askSheriff("campus", "a campus")}
          />
          {values.kind === "missing_item" ? (
            <div className="form-field">
              <label className="form-field__label" htmlFor="wanted-last-seen">
                Where did you last see it?
                <span className="form-field__required"> (optional)</span>
              </label>
              <p className="form-field__hint" id="wanted-last-seen-hint">
                A building or room, for example &ldquo;Library level 2&rdquo;. Do not include phone
                numbers or addresses.
              </p>
              {errorFor("wanted-last-seen") === undefined ? null : (
                <p className="form-field__error" id="wanted-last-seen-error">
                  {errorFor("wanted-last-seen")}
                </p>
              )}
              <input
                className="form-field__input"
                id="wanted-last-seen"
                type="text"
                maxLength={160}
                value={values.lastSeenLocation}
                aria-describedby="wanted-last-seen-hint"
                onChange={(event) => update({ lastSeenLocation: event.target.value })}
              />
            </div>
          ) : null}
          {isAcademic ? (
            <>
              <SelectField
                id="wanted-faculty"
                label="Faculty or college"
                value={values.facultyId}
                options={taxonomy.faculties}
                placeholder="Choose a faculty"
                error={errorFor("wanted-faculty")}
                onChange={chooseFaculty}
                request={askSheriff("faculty", "a faculty")}
              />
              <SelectField
                id="wanted-programme"
                label="Programme"
                hint="Available once a faculty is chosen."
                value={values.programmeId}
                options={programmes}
                placeholder={
                  values.facultyId === "" ? "Choose a faculty first" : "Choose a programme"
                }
                error={errorFor("wanted-programme")}
                onChange={chooseProgramme}
                request={askSheriff("programme", "a programme")}
              />
              <SelectField
                id="wanted-course"
                label="Course"
                hint="Available once a programme is chosen."
                value={values.courseId}
                options={courses.map((course: CourseOption) => ({
                  id: course.id,
                  label: courseLabel(course),
                }))}
                placeholder={
                  values.programmeId === "" ? "Choose a programme first" : "Choose a course"
                }
                error={errorFor("wanted-course")}
                onChange={(courseId) => update({ courseId })}
                request={askSheriff("course", "a course")}
              />
              <SelectField
                id="wanted-session"
                label="Academic session"
                hint="Leave as any session if it does not matter."
                value={values.sessionId}
                options={taxonomy.academicSessions}
                placeholder="Any session"
                optional
                error={errorFor("wanted-session")}
                onChange={(sessionId) => update({ sessionId })}
                request={askSheriff("academic_session", "a session")}
              />
              <SelectField
                id="wanted-resource-type"
                label="Resource type"
                value={values.resourceTypeId}
                options={taxonomy.resourceTypes}
                placeholder="Choose a resource type"
                error={errorFor("wanted-resource-type")}
                onChange={(resourceTypeId) => update({ resourceTypeId })}
                request={askSheriff("resource_type", "a resource type")}
              />
              <SelectField
                id="wanted-language"
                label="Language"
                value={values.languageId}
                options={taxonomy.languages}
                placeholder="Choose a language"
                error={errorFor("wanted-language")}
                onChange={(languageId) => update({ languageId })}
              />
            </>
          ) : null}
        </div>

        {isAcademic ? (
          <fieldset className="draft-form__fieldset" id="wanted-tags">
            <legend className="draft-form__legend">Tags (optional, up to five)</legend>
            {tagError === undefined ? null : (
              <p className="form-field__error" id="wanted-tags-error">
                {tagError}
              </p>
            )}
            {taxonomy.tags.length === 0 ? (
              <p className="form-field__hint">No tags have been added yet.</p>
            ) : (
              <div className="draft-form__choices">
                {taxonomy.tags.map((tag: TaxonomyItem) => (
                  <label className="draft-form__choice" key={tag.id}>
                    <input
                      type="checkbox"
                      checked={values.tagIds.includes(tag.id)}
                      disabled={!values.tagIds.includes(tag.id) && values.tagIds.length >= 5}
                      onChange={(event) => toggleTag(tag.id, event.target.checked)}
                    />
                    {tag.label}
                  </label>
                ))}
              </div>
            )}
            <p className="form-field__request">{askSheriff("tag", "a tag")}</p>
          </fieldset>
        ) : null}
      </section>

      <section className="draft-form__section">
        <h2 className="draft-form__section-heading">Duration and bounty</h2>

        <div className="form-field slider-field">
          <label className="form-field__label" htmlFor="wanted-duration">
            How long should the request stay open?
          </label>
          <p className="form-field__hint" id="wanted-duration-hint">
            {MIN_DURATION_DAYS} to {MAX_DURATION_DAYS} days, fixed when it is published. A request
            cannot be extended in this release.
          </p>
          {durationError === undefined ? null : (
            <p className="form-field__error" id="wanted-duration-error">
              {durationError}
            </p>
          )}
          <div className="slider-field__row">
            <input
              className="slider"
              id="wanted-duration"
              type="range"
              min={MIN_DURATION_DAYS}
              max={MAX_DURATION_DAYS}
              step={1}
              value={values.durationDays}
              aria-valuetext={`${values.durationDays} days`}
              aria-describedby="wanted-duration-hint"
              onChange={(event) => update({ durationDays: event.target.value })}
            />
            <output className="slider-field__value" htmlFor="wanted-duration">
              {values.durationDays} days
            </output>
          </div>
        </div>

        <fieldset className="draft-form__fieldset" id="wanted-bounty-choice">
          <legend className="draft-form__legend">Bounty</legend>
          <div className="draft-form__choices">
            <label className="draft-form__choice">
              <input
                type="radio"
                name="wanted-bounty-choice"
                checked={!values.free}
                onChange={() => update({ free: false })}
              />
              Offer a bounty
            </label>
            <label className="draft-form__choice">
              <input
                type="radio"
                name="wanted-bounty-choice"
                checked={values.free}
                disabled={noFreeLeft && !values.free}
                aria-describedby="wanted-free-allowance"
                onChange={() => update({ free: true })}
              />
              No bounty (free request)
            </label>
          </div>
          <p className="allowance-note" id="wanted-free-allowance">
            {allowance === null
              ? "Every member can post 3 free requests. Reward codes add more."
              : noFreeLeft
                ? "You have used all your free requests. "
                : `You have ${allowance.remaining} free request${allowance.remaining === 1 ? "" : "s"} left. `}
            {allowance === null ? null : (
              <Link href="/profile#reward-code">Redeem a reward code</Link>
            )}
          </p>
        </fieldset>

        {!values.free ? (
          <div className="form-field slider-field">
            <label className="form-field__label" htmlFor="wanted-contribution">
              Your first contribution
            </label>
            <p className="form-field__hint" id="wanted-contribution-hint">
              RM{MIN_CONTRIBUTION_SEN / 100} to RM{MAX_CONTRIBUTION_SEN / 100}. Yours starts the
              bounty; classmates add to it. The payment provider adds its own charge on top.
              {isAcademic
                ? null
                : " You release it by naming the member who helped; a Sheriff approves before anyone is paid."}
            </p>
            {errorFor("wanted-contribution") === undefined ? null : (
              <p className="form-field__error" id="wanted-contribution-error">
                {errorFor("wanted-contribution")}
              </p>
            )}
            <div className="slider-field__row">
              <input
                className="slider"
                id="wanted-contribution"
                type="range"
                min={MIN_CONTRIBUTION_SEN / 100}
                max={MAX_CONTRIBUTION_SEN / 100}
                step={1}
                value={values.contribution}
                aria-valuetext={`RM ${values.contribution}`}
                aria-invalid={errorFor("wanted-contribution") === undefined ? undefined : true}
                aria-describedby="wanted-contribution-hint"
                onChange={(event) => update({ contribution: event.target.value })}
              />
              <output className="slider-field__value numeric" htmlFor="wanted-contribution">
                RM {values.contribution}
              </output>
            </div>
          </div>
        ) : (
          <p className="policy-note">
            {isAcademic
              ? "A free request has no payment and no platform fee. When a Sheriff approves a claim, you receive the resource. Classmates cannot add money to a free request."
              : "A free request has no payment and no platform fee. People reply in writing; classmates cannot add money to it."}
          </p>
        )}
      </section>

      <section className="draft-form__section">
        <h2 className="draft-form__section-heading">Terms and conditions</h2>

        <div
          className="terms-box"
          tabIndex={0}
          role="region"
          aria-label={`VAULTIX posting terms, version ${TERMS_VERSION}`}
        >
          <p className="terms-box__meta">
            Version {TERMS_VERSION} · {TERMS_STATUS}
          </p>
          {POSTING_TERMS.map((section) => (
            <section key={section.heading}>
              <h3 className="terms-box__heading">{section.heading}</h3>
              <ul>
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {policyError === undefined ? null : (
          <p className="form-field__error" id="wanted-policy-error">
            {policyError}
          </p>
        )}

        <label
          className={`consent draft-form__policy${policyError === undefined ? "" : " consent--attention"}`}
          htmlFor="wanted-policy"
        >
          <input
            id="wanted-policy"
            type="checkbox"
            checked={values.policyAccepted}
            aria-invalid={policyError === undefined ? undefined : true}
            aria-describedby={policyError === undefined ? undefined : "wanted-policy-error"}
            onChange={(event) => update({ policyAccepted: event.target.checked })}
          />
          <span>
            I have read and agree to the VAULTIX posting terms (version {TERMS_VERSION}), and I will
            only request material that may lawfully be shared.
          </span>
        </label>
      </section>

      <div className="draft-form__actions">
        <button
          className="button button--primary"
          type="button"
          aria-disabled={busy ? true : undefined}
          onClick={onReview}
        >
          {`${isAcademic ? "Review request" : "Post request"}${busy ? " (working…)" : ""}`}
        </button>
        <Link className="button button--quiet" href="/board">
          Cancel and browse the Board
        </Link>
      </div>

      {entryRequest === null ? null : (
        <TaxonomyRequestDialog
          category={entryRequest}
          preview={mode === "preview"}
          parents={
            entryRequest === "programme"
              ? taxonomy.faculties
              : entryRequest === "course"
                ? taxonomy.programmes
                : []
          }
          defaultParentId={
            entryRequest === "programme"
              ? values.facultyId
              : entryRequest === "course"
                ? values.programmeId
                : ""
          }
          onClose={() => setEntryRequest(null)}
        />
      )}
    </div>
  );
}
