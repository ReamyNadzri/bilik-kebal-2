"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { ConfirmIdentity } from "./confirm-identity";
import { UiStatus } from "./ui-status";
import type {
  ConsoleBadge,
  ConsoleMember,
  ConsoleMemberAction,
  ConsoleOperationCode,
  ConsoleRole,
} from "@/contracts/console";
import { callOperation } from "@/features/presentation/call-operation";

const DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kuala_Lumpur",
});

const REASON = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

const ROLE_LABEL: Record<ConsoleRole, string> = {
  owner: "Owner",
  platform_sheriff: "Platform Sheriff",
  institution_sheriff: "Institution Sheriff",
};

export interface MemberConsoleProps {
  readonly role: ConsoleRole;
  readonly members: readonly ConsoleMember[] | null;
  readonly query: string;
  readonly institutions: readonly { id: string; name: string }[];
  readonly badges: readonly ConsoleBadge[];
}

/**
 * People management for the Owner and Sheriffs. It shows only the actions the
 * viewer's role allows, but that is a courtesy: each action is a database
 * function that checks the role again, needs a sign-in in the last 15
 * minutes, and is audited. There is no money here and no raw editing.
 */
export function MemberConsole({ role, members, query, institutions, badges }: MemberConsoleProps) {
  const router = useRouter();
  const [search, setSearch] = useState(query);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = search.trim();
    router.push(term ? `/console/people?q=${encodeURIComponent(term)}` : "/console/people");
  }

  return (
    <div className="ops-stack">
      <section className="panel ops-panel" aria-labelledby="people-search">
        <h2 className="ops-panel__title" id="people-search">
          Find a member
        </h2>
        <p className="form-field__hint">
          You are signed in as {ROLE_LABEL[role]}.{" "}
          {role === "institution_sheriff"
            ? "You see members of your institution only, without their email addresses."
            : "Search by name, email address or member id."}{" "}
          Every change asks for a reason and is recorded.
        </p>
        <form className="ops-form" role="search" onSubmit={onSearch}>
          <div className="form-field">
            <label className="form-field__label" htmlFor="member-search">
              Name, email or member id
            </label>
            <input
              className="form-field__input"
              id="member-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div>
            <button type="submit" className="button button--primary">
              Search
            </button>
          </div>
        </form>
      </section>

      {members === null ? (
        <UiStatus
          kind="error"
          heading="Members could not be loaded"
          message="Try again in a moment."
        />
      ) : members.length === 0 ? (
        <p className="replies__empty">No members match.</p>
      ) : (
        <ul className="ops-list" aria-label={`Members, ${members.length} shown`}>
          {members.map((member) => (
            <li key={member.publicId}>
              <MemberCard
                member={member}
                role={role}
                institutions={institutions}
                badges={badges.filter((badge) => !badge.retired)}
                onChanged={() => router.refresh()}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function describeRoles(roles: readonly string[], institutions: MemberConsoleProps["institutions"]) {
  return roles.map((value) => {
    if (value === "owner") return "Owner";
    if (value === "platform_sheriff") return "Platform Sheriff";
    const id = value.split(":")[1];
    return `Sheriff at ${institutions.find((item) => item.id === id)?.name ?? "an institution"}`;
  });
}

function MemberCard({
  member,
  role,
  institutions,
  badges,
  onChanged,
}: {
  readonly member: ConsoleMember;
  readonly role: ConsoleRole;
  readonly institutions: MemberConsoleProps["institutions"];
  readonly badges: readonly ConsoleBadge[];
  readonly onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const staff = role === "owner" || role === "platform_sheriff";
  const owner = role === "owner";
  const isOwner = member.roles.includes("owner");
  const roles = describeRoles(member.roles, institutions);
  const headingId = `member-${member.publicId}`;

  return (
    <article className="panel ops-panel" aria-labelledby={headingId}>
      <div className="ops-panel__head">
        <h3 className="ops-panel__title" id={headingId}>
          <Link href={`/u/${member.publicId}`}>{member.displayName}</Link>
        </h3>
        {isOwner && !owner ? null : (
          <button
            type="button"
            className="button button--compact"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Close" : "Manage"}
          </button>
        )}
      </div>
      <dl className="index-grid">
        {member.email ? (
          <>
            <dt>Email</dt>
            <dd>
              {member.email} {member.emailVerified ? "(confirmed)" : "(not confirmed)"}
            </dd>
          </>
        ) : null}
        <dt>Joined</dt>
        <dd>{DATE.format(new Date(member.joinedAt))}</dd>
        <dt>Institution</dt>
        <dd>
          {member.institution
            ? `${member.institution.name} (${member.institution.state})`
            : "None chosen"}
        </dd>
        {roles.length ? (
          <>
            <dt>Roles</dt>
            <dd>{roles.join(", ")}</dd>
          </>
        ) : null}
        <dt>Status</dt>
        <dd>
          {member.restriction === null
            ? "Active"
            : member.restriction.expiresAt
              ? `Timed out until ${DATE.format(new Date(member.restriction.expiresAt))} (${member.restriction.reasonCode})`
              : `Restricted permanently (${member.restriction.reasonCode})`}
        </dd>
        {member.badge ? (
          <>
            <dt>Badge</dt>
            <dd>{member.badge.name}</dd>
          </>
        ) : null}
      </dl>

      {open ? (
        <div className="ops-stack">
          {member.restriction === null ? (
            <ActionForm
              title="Time out"
              hint="They can browse but cannot post, reply, claim or fund until it ends. It lifts by itself."
              publicId={member.publicId}
              submitLabel="Time out"
              build={(values) => ({
                action: "timeout",
                hours: Number(values.hours) as 1 | 24 | 168,
                reasonCode: values.reason ?? "",
              })}
              onDone={onChanged}
            >
              <SelectField
                name="hours"
                label="For"
                options={[
                  ["1", "1 hour"],
                  ["24", "24 hours"],
                  ["168", "7 days"],
                ]}
              />
              <ReasonField />
            </ActionForm>
          ) : member.restriction.expiresAt !== null || owner ? (
            <ActionForm
              title={member.restriction.expiresAt ? "End the timeout now" : "Lift the restriction"}
              publicId={member.publicId}
              submitLabel="Lift"
              build={() => ({ action: "lift" })}
              onDone={onChanged}
            />
          ) : null}

          {owner ? (
            <ActionForm
              title="Restrict permanently"
              hint="Owner only. Stays until you lift it. Use for serious or repeated abuse."
              publicId={member.publicId}
              submitLabel="Restrict permanently"
              build={(values) => ({ action: "restrict", reasonCode: values.reason ?? "" })}
              onDone={onChanged}
            >
              <ReasonField />
            </ActionForm>
          ) : null}

          {staff ? (
            <ActionForm
              title="Change display name"
              hint="For names that break the rules. The member is not asked first."
              publicId={member.publicId}
              submitLabel="Rename"
              build={(values) => ({
                action: "rename",
                name: values.name ?? "",
                reasonCode: values.reason ?? "",
              })}
              onDone={onChanged}
            >
              <TextField name="name" label="New display name" maxLength={100} />
              <ReasonField />
            </ActionForm>
          ) : null}

          {staff ? (
            <ActionForm
              title="Reset profile picture"
              hint="Removes their photo or drawn character; they see the default drawing."
              publicId={member.publicId}
              submitLabel="Reset picture"
              build={(values) => ({ action: "reset_avatar", reasonCode: values.reason ?? "" })}
              onDone={onChanged}
            >
              <ReasonField />
            </ActionForm>
          ) : null}

          {owner && institutions.length > 0 ? (
            <ActionForm
              title="Institution verification"
              hint="Verified members can fund, claim and download, and earn the star. Revoking removes that at once."
              publicId={member.publicId}
              submitLabel="Save verification"
              build={(values) => ({
                action: "set_verification",
                institutionId: values.institution ?? "",
                verified: values.verified === "yes",
                reasonCode: values.reason ?? "",
              })}
              onDone={onChanged}
            >
              <SelectField
                name="institution"
                label="Institution"
                options={institutions.map((item) => [item.id, item.name])}
                initial={member.institution?.id}
              />
              <SelectField
                name="verified"
                label="Set to"
                options={[
                  ["yes", "Verified"],
                  ["no", "Not verified (revoke)"],
                ]}
              />
              <ReasonField />
            </ActionForm>
          ) : null}

          {owner && !isOwner ? (
            <ActionForm
              title="Sheriff role"
              hint="A platform Sheriff reviews across every institution; an institution Sheriff only there."
              publicId={member.publicId}
              submitLabel="Save role"
              build={(values) => ({
                action: "set_sheriff",
                institutionId: values.scope === "platform" ? null : (values.scope ?? null),
                appoint: values.appoint === "yes",
              })}
              onDone={onChanged}
            >
              <SelectField
                name="scope"
                label="Where"
                options={[
                  ["platform", "Platform-wide"],
                  ...institutions.map((item): [string, string] => [item.id, item.name]),
                ]}
              />
              <SelectField
                name="appoint"
                label="Action"
                options={[
                  ["yes", "Appoint as Sheriff"],
                  ["no", "Remove as Sheriff"],
                ]}
              />
            </ActionForm>
          ) : null}

          {owner ? (
            <ActionForm
              title="Badge"
              hint="Shown beside their name across VAULTIX. Separate from the verified star."
              publicId={member.publicId}
              submitLabel="Save badge"
              build={(values) => ({
                action: "set_badge",
                badgeId: values.badge ? values.badge : null,
              })}
              onDone={onChanged}
            >
              <SelectField
                name="badge"
                label="Badge"
                options={[["", "No badge"], ...badges.map((b): [string, string] => [b.id, b.name])]}
                initial={member.badge?.id ?? ""}
              />
            </ActionForm>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

type Values = Record<string, string>;

/**
 * One console action. Reads its fields by name, validates reason codes,
 * posts, and asks for the password in place when the 15-minute step-up has
 * lapsed, then retries.
 */
function ActionForm({
  title,
  hint,
  publicId,
  submitLabel,
  build,
  onDone,
  children,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly publicId: string;
  readonly submitLabel: string;
  readonly build: (values: Values) => ConsoleMemberAction;
  readonly onDone: () => void;
  readonly children?: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<ConsoleMemberAction | null>(null);
  const [done, setDone] = useState(false);

  async function send(action: ConsoleMemberAction) {
    setBusy(true);
    setError(null);
    const result = await callOperation<{ done: true }, ConsoleOperationCode>(
      `/api/console/members/${encodeURIComponent(publicId)}`,
      action,
      "CONSOLE_UNAVAILABLE",
    );
    setBusy(false);
    if (!result.ok) {
      if (result.code === "RECENT_AUTH_REQUIRED") {
        setStepUp(action);
        return;
      }
      setError(result.message || "The change was not saved. Try again.");
      return;
    }
    setStepUp(null);
    setDone(true);
    onDone();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(
      [...new FormData(event.currentTarget).entries()].map(([key, value]) => [
        key,
        String(value).trim(),
      ]),
    );
    if ("reason" in values && !REASON.test(values.reason ?? "")) {
      setError("Enter a reason code: lower-case letters, numbers and underscores.");
      return;
    }
    if ("name" in values && !values.name) {
      setError("Enter a display name.");
      return;
    }
    void send(build(values));
  }

  return (
    <div className="ops-form">
      <form className="ops-form" onSubmit={onSubmit} noValidate aria-label={title}>
        <h4 className="ops-panel__title">{title}</h4>
        {hint ? <p className="form-field__hint">{hint}</p> : null}
        {error ? (
          <p className="form-field__error" role="alert">
            {error}
          </p>
        ) : null}
        {done ? (
          <p className="ops-alert ops-alert--success" role="status">
            Saved.
          </p>
        ) : null}
        {children}
        {stepUp ? null : (
          <div>
            <button type="submit" className="button button--primary" disabled={busy}>
              {busy ? "Saving…" : submitLabel}
            </button>
          </div>
        )}
      </form>
      {/*
      Outside the action's form. Nested, confirming the password also
      submitted the action again, which raced the re-sign-in and came back
      asking for the password again, so the change never saved.
    */}
      {stepUp ? (
        <ConfirmIdentity purpose="make this change" onConfirmed={() => void send(stepUp)} />
      ) : null}
    </div>
  );
}

let fieldCounter = 0;
function useFieldId(name: string) {
  const [id] = useState(() => `console-${name}-${(fieldCounter += 1)}`);
  return id;
}

function ReasonField() {
  const id = useFieldId("reason");
  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        Reason code
      </label>
      <p className="form-field__hint" id={`${id}-hint`}>
        Lower-case letters, numbers and underscores, for example offensive_name or spam.
      </p>
      <input
        className="form-field__input"
        id={id}
        name="reason"
        type="text"
        aria-describedby={`${id}-hint`}
      />
    </div>
  );
}

function TextField({
  name,
  label,
  maxLength,
}: {
  readonly name: string;
  readonly label: string;
  readonly maxLength: number;
}) {
  const id = useFieldId(name);
  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        {label}
      </label>
      <input className="form-field__input" id={id} name={name} maxLength={maxLength} />
    </div>
  );
}

function SelectField({
  name,
  label,
  options,
  initial,
}: {
  readonly name: string;
  readonly label: string;
  readonly options: ReadonlyArray<readonly [string, string]>;
  readonly initial?: string | undefined;
}) {
  const id = useFieldId(name);
  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        {label}
      </label>
      <select className="form-field__input" id={id} name={name} defaultValue={initial}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
