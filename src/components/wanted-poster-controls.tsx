"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  COURSE_CODE_PATTERN,
  DESCRIPTION_MIN_LENGTH,
  type MarketplaceOperationCode,
  type MarketplaceTaxonomy,
  type TaxonomyItem,
  type WantedChangeLock,
  type WantedChangeWindow,
  type WantedEditableDetails,
  type WantedPosterEditInput,
} from "@/contracts/marketplace";
import { formatRinggit, type Sen } from "@/features/marketplace/money";
import { programmesFor } from "@/features/marketplace/taxonomy";
import { callOperation } from "@/features/presentation/call-operation";
import { CourseCodeCombobox } from "./course-code-combobox";
import { FormField } from "./form-field";
import { SearchSelect } from "./search-select";
import { SelectField } from "./select-field";
import { MAX_TAGS, requestTag, TagPicker } from "./tag-picker";

export interface WantedPosterControlsProps {
  readonly wantedId: string;
  /** The Wanted as published; null when it could not be read (no edit form then). */
  readonly editable: WantedEditableDetails | null;
  /** The lists of the Wanted's own university; null when they could not be read. */
  readonly taxonomy: MarketplaceTaxonomy | null;
  readonly isFree: boolean;
  readonly grossBountySen: Sen;
  readonly backerCount: number;
  readonly window: WantedChangeWindow;
  /** The render's clock, so the first paint agrees with the server. */
  readonly now: string;
}

const LOCK_COPY: Readonly<Record<WantedChangeLock, string>> = {
  not_open: "Only an open Wanted can be edited or withdrawn.",
  window_closed:
    "Locked as published. Edits and withdrawal are open for the first hour after publishing only.",
  claim_submitted:
    "Locked as published. A Hunter has submitted a claim, so the request stays as they read it.",
  reply_received: "Locked as published. Someone has replied, so the request stays as they read it.",
};

function minutesLeft(until: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(until) - now) / 60_000));
}

function clockTime(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", { hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

/**
 * The poster's own edit and withdraw controls for a published Wanted.
 *
 * Open for one hour after publishing and closed early by the first claim or
 * reply from someone else. The countdown is a courtesy: the database decides
 * under a row lock and refuses a late change, and the refusal is shown as-is.
 */
export function WantedPosterControls({
  wantedId,
  editable,
  taxonomy,
  isFree,
  grossBountySen,
  backerCount,
  window: changeWindow,
  now,
}: WantedPosterControlsProps) {
  const [clock, setClock] = useState(() => Date.parse(now));
  const [dialog, setDialog] = useState<"edit" | "withdraw" | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const remaining = minutesLeft(changeWindow.editableUntil, clock);
  const lock: WantedChangeLock | null =
    changeWindow.lockedReason ?? (remaining === 0 ? "window_closed" : null);

  if (lock !== null) {
    return (
      <div className="ledger-panel poster-controls poster-controls--locked">
        <h2 className="ledger-panel__heading">Your Wanted</h2>
        <p className="ledger-panel__body">{LOCK_COPY[lock]}</p>
      </div>
    );
  }

  const canEdit = editable !== null && taxonomy !== null;

  return (
    <div className="ledger-panel poster-controls">
      <h2 className="ledger-panel__heading">Your Wanted</h2>
      <p className="ledger-panel__body">
        You can edit the details or withdraw this request until{" "}
        <time dateTime={changeWindow.editableUntil}>{clockTime(changeWindow.editableUntil)}</time> (
        <span className="numeric">
          {remaining} {remaining === 1 ? "minute" : "minutes"}
        </span>{" "}
        left). After that, or once a claim or reply arrives, it is locked as published.
      </p>
      {canEdit ? null : (
        <p className="ledger-panel__body">
          The edit form could not be loaded. Reload the page to try again.
        </p>
      )}
      <div className="poster-controls__actions">
        {canEdit ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setDialog("edit")}
          >
            Edit
          </button>
        ) : null}
        <button
          type="button"
          className="button button--danger-outline"
          onClick={() => setDialog("withdraw")}
        >
          Withdraw
        </button>
      </div>

      {dialog === "edit" && canEdit ? (
        <EditDialog
          wantedId={wantedId}
          details={editable}
          taxonomy={taxonomy}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "withdraw" ? (
        <WithdrawDialog
          wantedId={wantedId}
          isFree={isFree}
          grossBountySen={grossBountySen}
          backerCount={backerCount}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function useDialogKeys(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return ref;
}

function refusalMessage(code: MarketplaceOperationCode, message: string): string {
  if (code === "WANTED_LOCKED" || code === "VALIDATION_ERROR") return message;
  if (code === "AUTH_REQUIRED") return "Your session has ended. Sign in again and retry.";
  if (code === "ACCOUNT_RESTRICTED") return "A restriction on your account blocks changes.";
  if (code === "WANTED_NOT_FOUND") return "This Wanted is no longer available to change.";
  if (code === "INSTITUTION_VERIFICATION_REQUIRED" && message !== "") return message;
  return "Nothing was changed. Check your connection and try again.";
}

/** The form's values: every choice as a string, "" for none. */
interface EditValues {
  title: string;
  description: string;
  campusId: string;
  facultyId: string;
  programmeId: string;
  courseCode: string;
  sessionId: string;
  resourceTypeId: string;
  languageId: string;
  lastSeenLocation: string;
  tagIds: readonly string[];
}

function startingValues(details: WantedEditableDetails): EditValues {
  return {
    title: details.title,
    description: details.description,
    campusId: details.campusId,
    facultyId: details.facultyId ?? "",
    programmeId: details.programmeId ?? "",
    courseCode: details.courseCode ?? "",
    sessionId: details.academicSessionId ?? "",
    resourceTypeId: details.resourceTypeId ?? "",
    languageId: details.languageId ?? "",
    lastSeenLocation: details.lastSeenLocation ?? "",
    tagIds: details.tagIds,
  };
}

type EditErrors = Partial<Record<keyof EditValues, string>>;

/** The rules the server applies, checked first so a save is not wasted. */
function editErrors(kind: WantedEditableDetails["kind"], values: EditValues): EditErrors {
  const errors: EditErrors = {};
  const titleLength = values.title.trim().length;
  const descriptionLength = values.description.trim().length;
  if (titleLength < 8 || titleLength > 120) errors.title = "Use 8 to 120 characters.";
  if (descriptionLength < DESCRIPTION_MIN_LENGTH || descriptionLength > 2000)
    errors.description = `Use ${DESCRIPTION_MIN_LENGTH} to 2000 characters.`;
  if (values.campusId === "") errors.campusId = "Choose a campus.";
  if (kind === "missing_item") {
    const place = values.lastSeenLocation.trim().length;
    if (place === 1 || place > 160) errors.lastSeenLocation = "Use 2 to 160 characters.";
  }
  if (kind === "academic") {
    if (values.facultyId === "") errors.facultyId = "Choose a faculty or college.";
    if (values.programmeId === "") errors.programmeId = "Choose a programme.";
    if (!COURSE_CODE_PATTERN.test(values.courseCode))
      errors.courseCode = "Type a course code such as CSC510.";
    if (values.resourceTypeId === "") errors.resourceTypeId = "Choose a resource type.";
    if (values.languageId === "") errors.languageId = "Choose a language.";
  }
  return errors;
}

/** What the server is sent: the fields the kind uses, null for the rest. */
function toEditInput(
  kind: WantedEditableDetails["kind"],
  values: EditValues,
): WantedPosterEditInput {
  const academic = kind === "academic";
  const orNull = (value: string) => (academic && value !== "" ? value : null);
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    campusId: values.campusId,
    facultyId: orNull(values.facultyId),
    programmeId: orNull(values.programmeId),
    courseCode: orNull(values.courseCode),
    academicSessionId: orNull(values.sessionId),
    resourceTypeId: orNull(values.resourceTypeId),
    languageId: orNull(values.languageId),
    lastSeenLocation:
      kind === "missing_item" && values.lastSeenLocation.trim() !== ""
        ? values.lastSeenLocation.trim()
        : null,
    tagIds: [...values.tagIds],
  };
}

function EditDialog({
  wantedId,
  details,
  taxonomy,
  onClose,
}: {
  readonly wantedId: string;
  readonly details: WantedEditableDetails;
  readonly taxonomy: MarketplaceTaxonomy;
  readonly onClose: () => void;
}) {
  const router = useRouter();
  const ref = useDialogKeys(onClose);
  const [values, setValues] = useState<EditValues>(() => startingValues(details));
  const [addedTags, setAddedTags] = useState<readonly TaxonomyItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind = details.kind;
  const academic = kind === "academic";
  const errors = editErrors(kind, values);
  const invalid = Object.keys(errors).length > 0;
  const tags = [...taxonomy.tags, ...addedTags];
  // Every programme is searchable until a faculty narrows the list.
  const programmes =
    values.facultyId === "" ? taxonomy.programmes : programmesFor(taxonomy, values.facultyId);

  function update(patch: Partial<EditValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  /** A faculty keeps the programme only when it is under that faculty. */
  function chooseFaculty(facultyId: string) {
    const programme = taxonomy.programmes.find((option) => option.id === values.programmeId);
    update({
      facultyId,
      programmeId: programme?.facultyId === facultyId ? values.programmeId : "",
    });
  }

  /** A programme fills in its own faculty. */
  function chooseProgramme(programmeId: string) {
    const programme = taxonomy.programmes.find((option) => option.id === programmeId);
    update({ programmeId, facultyId: programme?.facultyId ?? values.facultyId });
  }

  function toggleTag(tagId: string, checked: boolean) {
    setValues((current) => ({
      ...current,
      tagIds: checked ? [...current.tagIds, tagId] : current.tagIds.filter((id) => id !== tagId),
    }));
  }

  async function addTag(name: string): Promise<string | null> {
    const known = tags.find((tag) => tag.label.toLowerCase() === name.toLowerCase());
    if (known) {
      if (!values.tagIds.includes(known.id) && values.tagIds.length < MAX_TAGS) {
        toggleTag(known.id, true);
      }
      return null;
    }
    if (values.tagIds.length >= MAX_TAGS) return "A request can have up to five tags.";
    const result = await requestTag(name);
    if (!result.ok) return result.message || "The tag could not be added. Try again.";
    const tag = result.data;
    if (!tags.some((item) => item.id === tag.id)) setAddedTags((current) => [...current, tag]);
    toggleTag(tag.id, true);
    return null;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (invalid) return;
    setSaving(true);
    setError(null);
    const result = await callOperation<{ state: "edited" }, MarketplaceOperationCode>(
      `/api/marketplace/wanted/${encodeURIComponent(wantedId)}`,
      toEditInput(kind, values),
      "MARKETPLACE_UNAVAILABLE",
      "PATCH",
    );
    setSaving(false);
    if (result.ok) {
      onClose();
      router.refresh();
      return;
    }
    setError(refusalMessage(result.code, result.message));
  }

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-wanted-title"
      ref={ref}
      tabIndex={-1}
    >
      <form className="dialog dialog--wide" onSubmit={(event) => void save(event)} noValidate>
        <div className="dialog__head">
          <h2 id="edit-wanted-title" className="dialog__title">
            Edit your Wanted
          </h2>
          <button
            type="button"
            className="button button--quiet dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <p className="dialog__note">
          You can correct the details below in the first hour. The university, bounty, duration and
          fee stay as published. The previous version is kept on record.
        </p>
        {error ? (
          <p className="form-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <FormField
          id="edit-wanted-title-input"
          label="Title"
          required
          value={values.title}
          maxLength={120}
          onChange={(event) => update({ title: event.target.value })}
          hint="8 to 120 characters."
          error={errors.title}
        />
        <div className="form-field">
          <label className="form-field__label" htmlFor="edit-wanted-description">
            Description<span className="form-field__required"> (required)</span>
          </label>
          <p className="form-field__hint" id="edit-wanted-description-hint">
            {DESCRIPTION_MIN_LENGTH} to 2000 characters.
          </p>
          {errors.description ? (
            <p className="form-field__error" id="edit-wanted-description-error">
              {errors.description}
            </p>
          ) : null}
          <textarea
            className="form-field__input draft-form__textarea"
            id="edit-wanted-description"
            rows={6}
            required
            maxLength={2000}
            value={values.description}
            onChange={(event) => update({ description: event.target.value })}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={
              errors.description
                ? "edit-wanted-description-hint edit-wanted-description-error"
                : "edit-wanted-description-hint"
            }
          />
        </div>
        <SelectField
          id="edit-wanted-campus"
          label="Campus"
          hint="Campuses marked coming soon are not open for requests yet."
          value={values.campusId}
          options={taxonomy.campuses.map((campus) => ({
            id: campus.id,
            label: campus.regionOpen ? campus.label : `${campus.label} (coming soon)`,
            disabled: !campus.regionOpen && campus.id !== details.campusId,
          }))}
          placeholder="Choose a campus"
          error={errors.campusId}
          onChange={(campusId) => update({ campusId })}
        />
        {kind === "missing_item" ? (
          <FormField
            id="edit-wanted-last-seen"
            label="Where did you last see it? (optional)"
            value={values.lastSeenLocation}
            maxLength={160}
            onChange={(event) => update({ lastSeenLocation: event.target.value })}
            hint="A building or room, for example Library level 2. Do not include phone numbers or addresses."
            error={errors.lastSeenLocation}
          />
        ) : null}
        {academic ? (
          <>
            <SearchSelect
              id="edit-wanted-faculty"
              label="Faculty or college"
              hint="Type part of its name. Choosing a programme fills it in."
              value={values.facultyId}
              options={taxonomy.faculties}
              placeholder="Search faculties and colleges"
              noun="faculty"
              nounPlural="faculties"
              error={errors.facultyId}
              onChange={chooseFaculty}
            />
            <SearchSelect
              id="edit-wanted-programme"
              label="Programme"
              hint="Type the programme code or part of its name."
              value={values.programmeId}
              options={programmes}
              placeholder="Search programmes"
              noun="programme"
              error={errors.programmeId}
              onChange={chooseProgramme}
            />
            <CourseCodeCombobox
              id="edit-wanted-course"
              value={values.courseCode}
              courses={taxonomy.courses}
              error={errors.courseCode}
              onChange={(courseCode) => update({ courseCode })}
            />
            <SelectField
              id="edit-wanted-session"
              label="Academic session"
              hint="Leave as any session if it does not matter."
              value={values.sessionId}
              options={taxonomy.academicSessions}
              placeholder="Any session"
              optional
              error={undefined}
              onChange={(sessionId) => update({ sessionId })}
            />
            <SelectField
              id="edit-wanted-resource-type"
              label="Resource type"
              value={values.resourceTypeId}
              options={taxonomy.resourceTypes}
              placeholder="Choose a resource type"
              error={errors.resourceTypeId}
              onChange={(resourceTypeId) => update({ resourceTypeId })}
            />
            <SelectField
              id="edit-wanted-language"
              label="Language"
              value={values.languageId}
              options={taxonomy.languages}
              placeholder="Choose a language"
              error={errors.languageId}
              onChange={(languageId) => update({ languageId })}
            />
          </>
        ) : null}
        <TagPicker
          idPrefix="edit-wanted"
          tags={tags}
          selected={values.tagIds}
          onToggle={toggleTag}
          onAdd={addTag}
        />
        <div className="dialog__actions">
          <button type="button" className="button button--quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={saving || invalid}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function WithdrawDialog({
  wantedId,
  isFree,
  grossBountySen,
  backerCount,
  onClose,
}: {
  readonly wantedId: string;
  readonly isFree: boolean;
  readonly grossBountySen: Sen;
  readonly backerCount: number;
  readonly onClose: () => void;
}) {
  const router = useRouter();
  const ref = useDialogKeys(onClose);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = !isFree && grossBountySen > 0;

  async function withdraw() {
    setBusy(true);
    setError(null);
    const result = await callOperation<
      { state: "withdrawn"; refundsQueued: number },
      MarketplaceOperationCode
    >(
      `/api/marketplace/wanted/${encodeURIComponent(wantedId)}/withdraw`,
      {},
      "MARKETPLACE_UNAVAILABLE",
    );
    if (result.ok) {
      router.replace("/profile?withdrawn=1");
      return;
    }
    setBusy(false);
    setError(refusalMessage(result.code, result.message));
  }

  return (
    <div
      className="dialog-backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="withdraw-wanted-title"
      aria-describedby="withdraw-wanted-consequences"
      ref={ref}
      tabIndex={-1}
    >
      <div className="dialog">
        <div className="dialog__head">
          <h2 id="withdraw-wanted-title" className="dialog__title">
            Withdraw this Wanted?
          </h2>
          <button
            type="button"
            className="button button--quiet dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div id="withdraw-wanted-consequences">
          <p className="dialog__lede">
            It leaves the Board at once and cannot be reopened. Hunters can no longer claim it.
          </p>
          {paid ? (
            <p className="dialog__note">
              Refund: the full bounty of{" "}
              <strong className="numeric">{formatRinggit(grossBountySen)}</strong> from{" "}
              {backerCount} {backerCount === 1 ? "Backer" : "Backers"}, your own contribution
              included, goes to the refund queue. The platform refunds each contribution in full, by
              hand; it is not instant. No platform fee is taken. The payment provider&rsquo;s own
              checkout charge was never part of the bounty and is not included in this refund.
            </p>
          ) : (
            <p className="dialog__note">
              No money is involved. {isFree ? "The free request it used is not returned." : ""}
            </p>
          )}
        </div>
        {error ? (
          <p className="form-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog__actions">
          <button type="button" className="button button--quiet" onClick={onClose} disabled={busy}>
            Keep it
          </button>
          <button
            type="button"
            className="button button--danger-outline"
            onClick={() => void withdraw()}
            disabled={busy}
          >
            {busy ? "Withdrawing…" : "Withdraw this Wanted"}
          </button>
        </div>
      </div>
    </div>
  );
}
