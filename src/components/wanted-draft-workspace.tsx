"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BountyPlate } from "./bounty-plate";
import { ErrorSummary } from "./error-summary";
import { UiStatus, type UiStatusKind } from "./ui-status";
import { WantedCard } from "./wanted-card";
import type {
  CourseOption,
  MarketplaceOperationCode,
  MarketplaceTaxonomy,
  TaxonomyItem,
  WantedDuplicateSuggestion,
} from "@/contracts/marketplace";
import {
  checkWantedDuplicates,
  requestWantedPublication,
  saveWantedDraft,
} from "@/features/marketplace/draft-operations";
import {
  messageFor,
  toDraftFieldErrors,
  type DraftFieldError,
} from "@/features/marketplace/marketplace-messages";
import { formatRinggit } from "@/features/marketplace/money";
import { courseLabel, coursesFor, programmesFor } from "@/features/marketplace/taxonomy";
import {
  DURATION_DAYS,
  emptyDraft,
  toDraftInput,
  validateDraft,
  type ValidatedDraft,
  type WantedDraftValues,
} from "@/features/marketplace/wanted-draft";

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
  | { readonly kind: "awaiting-payment" };

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
function refusalFor(code: MarketplaceOperationCode): Refusal {
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
    case "DRAFT_NOT_FOUND":
      return { status: "expired", heading: "That draft is no longer on your account" };
    case "DRAFT_NOT_EDITABLE":
      return { status: "expired", heading: "This request can no longer be edited" };
    default:
      return { status: "offline", heading: "Your draft could not be saved" };
  }
}

interface SelectFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly value: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly placeholder: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
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
}: SelectFieldProps) {
  const hintId = hint === undefined ? undefined : `${id}-hint`;
  const errorId = error === undefined ? undefined : `${id}-error`;
  const describedBy = [hintId, errorId].filter((entry) => entry !== undefined).join(" ");

  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        {label}
        <span className="form-field__required"> (required)</span>
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
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
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
  const summaryRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (feedback.kind === "fields" && feedback.errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [feedback]);

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
  function refuse(code: MarketplaceOperationCode, message: string | undefined) {
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
    if (busyRef.current || review === null || review.token === null || draftId === null) {
      return;
    }

    busyRef.current = true;

    try {
      setStep("publishing");
      setAnnouncement("Asking to prepare payment.");

      const result = await requestWantedPublication(
        draftId,
        review.token,
        review.draft.contributionSen,
      );

      setAnnouncement("");

      if (result.ok) {
        // Awaiting payment is not a payment. No Wanted is open.
        setOutcome({ kind: "awaiting-payment" });
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

  if (review !== null) {
    const { draft } = review;

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
              <SummaryRow term="Session">{draft.session.label}</SummaryRow>
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
              <BountyPlate
                amountSen={draft.contributionSen}
                label="Your first contribution"
                size="large"
              />
              <p className="ledger-panel__backers">Starts the bounty</p>
            </div>

            <div className="ledger-panel">
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
                </section>
              ) : null}

              <p className="policy-note">
                Your draft is private to you until a confirmed first contribution opens it. A
                Sheriff reviews every claim before any resource is released or any bounty is
                released to a Hunter.
              </p>

              <div className="draft-form__actions">
                {outcome.kind === "recheck" ? null : (
                  <button
                    className="button button--primary"
                    type="button"
                    aria-disabled={busy ? true : undefined}
                    onClick={onContinueToPayment}
                  >
                    {step === "publishing"
                      ? "Continue to payment (working…)"
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
        <h2 className="draft-form__section-heading">What you need</h2>

        <div className="form-field">
          <label className="form-field__label" htmlFor="wanted-title">
            Title
            <span className="form-field__required"> (required)</span>
          </label>
          <p className="form-field__hint" id="wanted-title-hint">
            Name the resource the way a classmate would search for it.
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
            What the resource needs to cover
            <span className="form-field__required"> (required)</span>
          </label>
          <p className="form-field__hint" id="wanted-description-hint">
            Chapters, topics, and whether working or diagrams matter. Hunters answer what you ask
            for.
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
            value={values.campusId}
            options={taxonomy.campuses}
            placeholder="Choose a campus"
            error={errorFor("wanted-campus")}
            onChange={(campusId) => update({ campusId })}
          />
          <SelectField
            id="wanted-faculty"
            label="Faculty or college"
            value={values.facultyId}
            options={taxonomy.faculties}
            placeholder="Choose a faculty"
            error={errorFor("wanted-faculty")}
            onChange={chooseFaculty}
          />
          <SelectField
            id="wanted-programme"
            label="Programme"
            hint="Available once a faculty is chosen."
            value={values.programmeId}
            options={programmes}
            placeholder={values.facultyId === "" ? "Choose a faculty first" : "Choose a programme"}
            error={errorFor("wanted-programme")}
            onChange={chooseProgramme}
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
            placeholder={values.programmeId === "" ? "Choose a programme first" : "Choose a course"}
            error={errorFor("wanted-course")}
            onChange={(courseId) => update({ courseId })}
          />
          <SelectField
            id="wanted-session"
            label="Academic session"
            value={values.sessionId}
            options={taxonomy.academicSessions}
            placeholder="Choose a session"
            error={errorFor("wanted-session")}
            onChange={(sessionId) => update({ sessionId })}
          />
          <SelectField
            id="wanted-resource-type"
            label="Resource type"
            value={values.resourceTypeId}
            options={taxonomy.resourceTypes}
            placeholder="Choose a resource type"
            error={errorFor("wanted-resource-type")}
            onChange={(resourceTypeId) => update({ resourceTypeId })}
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
        </div>

        <fieldset className="draft-form__fieldset" id="wanted-tags">
          <legend className="draft-form__legend">Tags (optional, up to five)</legend>
          {tagError === undefined ? null : (
            <p className="form-field__error" id="wanted-tags-error">
              {tagError}
            </p>
          )}
          <div className="draft-form__choices">
            {taxonomy.tags.map((tag: TaxonomyItem) => (
              <label className="draft-form__choice" key={tag.id}>
                <input
                  type="checkbox"
                  checked={values.tagIds.includes(tag.id)}
                  onChange={(event) => toggleTag(tag.id, event.target.checked)}
                />
                {tag.label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="draft-form__section">
        <h2 className="draft-form__section-heading">Duration and bounty</h2>

        <fieldset className="draft-form__fieldset" id="wanted-duration">
          <legend className="draft-form__legend">
            How long should the request stay open?
            <span className="form-field__required"> (required)</span>
          </legend>
          <p className="form-field__hint">
            Chosen once and fixed at publication. A request cannot be extended in this release.
          </p>
          {durationError === undefined ? null : (
            <p className="form-field__error" id="wanted-duration-error">
              {durationError}
            </p>
          )}
          <div className="draft-form__choices">
            {DURATION_DAYS.map((days) => (
              <label className="draft-form__choice" key={days}>
                <input
                  type="radio"
                  name="wanted-duration-days"
                  value={days}
                  checked={values.durationDays === String(days)}
                  onChange={() => update({ durationDays: String(days) })}
                />
                {`${days} days`}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-field draft-form__amount">
          <label className="form-field__label" htmlFor="wanted-contribution">
            Your first contribution
            <span className="form-field__required"> (required)</span>
          </label>
          <p className="form-field__hint" id="wanted-contribution-hint">
            Every contribution is RM1 to RM50. Yours starts the bounty; classmates add to it. The
            payment provider adds its own charge on top of this amount.
          </p>
          {errorFor("wanted-contribution") === undefined ? null : (
            <p className="form-field__error" id="wanted-contribution-error">
              {errorFor("wanted-contribution")}
            </p>
          )}
          <div className="draft-form__amount-row">
            <span className="draft-form__currency" aria-hidden="true">
              RM
            </span>
            <input
              className="form-field__input numeric"
              id="wanted-contribution"
              type="text"
              inputMode="decimal"
              value={values.contribution}
              aria-invalid={errorFor("wanted-contribution") === undefined ? undefined : true}
              aria-describedby={
                errorFor("wanted-contribution") === undefined
                  ? "wanted-contribution-hint"
                  : "wanted-contribution-hint wanted-contribution-error"
              }
              onChange={(event) => update({ contribution: event.target.value })}
            />
          </div>
          {values.contribution === "" ? null : (
            <p className="draft-form__amount-echo">
              {(() => {
                const check = validateDraft(values, taxonomy);
                return check.draft === null
                  ? null
                  : `That is ${formatRinggit(check.draft.contributionSen)}.`;
              })()}
            </p>
          )}
        </div>
      </section>

      <section className="draft-form__section">
        <h2 className="draft-form__section-heading">Content policy</h2>

        <p className="policy-note">
          Request only material a student is allowed to share. Publisher textbooks, paid tutorial
          material, leaked papers and institution-restricted documents are not permitted. A Sheriff
          reviews every claim before any resource is released or any bounty is released to a Hunter.
        </p>

        {policyError === undefined ? null : (
          <p className="form-field__error" id="wanted-policy-error">
            {policyError}
          </p>
        )}

        <label className="form-field__checkbox draft-form__policy" htmlFor="wanted-policy">
          <input
            id="wanted-policy"
            type="checkbox"
            checked={values.policyAccepted}
            aria-invalid={policyError === undefined ? undefined : true}
            aria-describedby={policyError === undefined ? undefined : "wanted-policy-error"}
            onChange={(event) => update({ policyAccepted: event.target.checked })}
          />
          <span>
            I have read the content policy and will only request material that may lawfully be
            shared.
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
          {step === "saving" || step === "checking"
            ? "Review request (working…)"
            : "Review request"}
        </button>
        <Link className="button button--quiet" href="/board">
          Cancel and browse the Board
        </Link>
      </div>
    </div>
  );
}
