"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BountyPlate } from "./bounty-plate";
import { ErrorSummary } from "./error-summary";
import { WantedCard } from "./wanted-card";
import { suggestDuplicates } from "@/features/marketplace/duplicate-suggestions";
import { formatRinggit } from "@/features/marketplace/money";
import {
  coursesFor,
  programmesFor,
  type CourseOption,
  type WantedTaxonomy,
} from "@/features/marketplace/taxonomy-source";
import { marketplaceNow } from "@/features/marketplace/wanted-source";
import {
  DURATION_DAYS,
  emptyDraft,
  validateDraft,
  type DraftFieldError,
  type ValidatedDraft,
  type WantedDraftValues,
} from "@/features/marketplace/wanted-draft";
import type { TaxonomyOption, WantedSummary } from "@/features/marketplace/types";

export interface WantedDraftWorkspaceProps {
  readonly taxonomy: WantedTaxonomy;
  /** Published requests the draft is compared against for duplicates. */
  readonly board: readonly WantedSummary[];
}

/**
 * The platform fee rate the backend will snapshot at publication, in basis
 * points. Shown so a Commissioner knows what is deducted before they part with
 * money; the authoritative rate travels with the published Wanted.
 */
const FEE_RATE_BASIS_POINTS = 1000;

function courseLabel(course: CourseOption): string {
  return `${course.code} ${course.name}`;
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
 * Everything here is presentation. No draft is stored, no duplicate token is
 * issued, no bill is created and no payment is taken — the operations that do
 * those things are Phase 3 backend work that has not landed. The review step
 * therefore ends in a statement, not a button: a control that looked like
 * "Publish" and did nothing would be worse than no control at all, and one
 * that claimed success would be a lie about money.
 *
 * Validation here is a courtesy to the reader. The server validates the same
 * draft again and RLS decides who may create one; this component decides no
 * authority (`context/architecture.md`).
 *
 * The review step keeps the entered values in state rather than re-deriving
 * them, so returning to edit loses nothing.
 */
export function WantedDraftWorkspace({ taxonomy, board }: WantedDraftWorkspaceProps) {
  const [values, setValues] = useState<WantedDraftValues>(emptyDraft);
  const [errors, setErrors] = useState<readonly DraftFieldError[]>([]);
  const [reviewing, setReviewing] = useState<ValidatedDraft | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [errors]);

  const errorFor = (fieldId: string): string | undefined =>
    errors.find((error) => error.fieldId === fieldId)?.message;

  function update(patch: Partial<WantedDraftValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  /**
   * Changing a faculty invalidates the programme under it, and changing a
   * programme invalidates the course. Clearing them is the honest behaviour:
   * the backend enforces the same hierarchy with composite foreign keys, so a
   * stale pair would be refused on submission anyway.
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

  function onReview() {
    const result = validateDraft(values, taxonomy);

    setErrors(result.errors);
    setReviewing(result.draft);
  }

  if (reviewing !== null) {
    const duplicates = suggestDuplicates(board, {
      courseId: reviewing.course.id,
      resourceTypeId: reviewing.resourceType.id,
      sessionId: reviewing.session.id,
      title: reviewing.title,
    });

    return (
      <div className="draft-review">
        <h2>Review your request</h2>

        <div className="draft-review__panels">
          <section className="draft-review__case">
            <h3 className="draft-review__title">{reviewing.title}</h3>
            <p className="draft-review__description">{reviewing.description}</p>

            <dl
              className="index-grid draft-review__summary"
              role="group"
              aria-label="Request summary"
            >
              <SummaryRow term="Campus">{reviewing.campus.label}</SummaryRow>
              <SummaryRow term="Faculty">{reviewing.faculty.label}</SummaryRow>
              <SummaryRow term="Programme">{reviewing.programme.label}</SummaryRow>
              <SummaryRow term="Course">{courseLabel(reviewing.course)}</SummaryRow>
              <SummaryRow term="Session">{reviewing.session.label}</SummaryRow>
              <SummaryRow term="Resource">{reviewing.resourceType.label}</SummaryRow>
              <SummaryRow term="Language">{reviewing.language.label}</SummaryRow>
              <SummaryRow term="Open for">{`${reviewing.durationDays} days`}</SummaryRow>
            </dl>

            {reviewing.tags.length === 0 ? null : (
              <ul className="tag-row" aria-label="Tags">
                {reviewing.tags.map((tag) => (
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
                amountSen={reviewing.contributionSen}
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
                The payment provider adds its own charge to your checkout total. It is paid on top
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
          <h3>Before you publish</h3>
          {duplicates.length === 0 ? (
            <p>
              No published request looks like yours. That check is advisory, and the server repeats
              it when publishing is connected.
            </p>
          ) : (
            <>
              <p>
                These requests already look similar. Backing one builds a single larger bounty
                instead of splitting your class across two. This is advisory and does not stop you
                from continuing.
              </p>
              <ul className="wanted-grid" aria-label="Requests that already look similar">
                {duplicates.map((wanted) => (
                  <WantedCard key={wanted.id} wanted={wanted} now={marketplaceNow()} />
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="draft-review__outcome">
          <h3>What happens next</h3>
          <p className="policy-note">
            No request, draft, contribution or payment has been created. This screen validates and
            previews your request only. Publishing becomes available when the payment operation is
            connected; a Wanted opens only after a verified payment provider callback confirms your
            first contribution, never from a redirect.
          </p>
          <p>
            <button
              className="button button--primary"
              type="button"
              onClick={() => setReviewing(null)}
            >
              Back to edit
            </button>
          </p>
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
      <ErrorSummary errors={[...errors]} ref={summaryRef} />

      <p className="draft-form__provenance">{taxonomy.provenance}</p>

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
            options={courses.map((course) => ({ id: course.id, label: courseLabel(course) }))}
            placeholder={values.programmeId === "" ? "Choose a programme first" : "Choose a course"}
            error={errorFor("wanted-course")}
            onChange={(courseId) => update({ courseId })}
          />
          <SelectField
            id="wanted-session"
            label="Academic session"
            value={values.sessionId}
            options={taxonomy.sessions}
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
            {taxonomy.tags.map((tag: TaxonomyOption) => (
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
                const check = validateDraft(
                  { ...values, contribution: values.contribution },
                  taxonomy,
                );
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
          reviews every claim before any resource is released or any bounty is paid.
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
        <button className="button button--primary" type="button" onClick={onReview}>
          Review request
        </button>
        <Link className="button button--quiet" href="/board">
          Cancel and browse the Board
        </Link>
      </div>
    </div>
  );
}
