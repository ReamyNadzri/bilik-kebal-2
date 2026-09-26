"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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

type Tab = "moderation" | "profile" | "roles";

const TAB_LABEL: Record<Tab, string> = {
  moderation: "Moderation",
  profile: "Profile",
  roles: "Roles & badge",
};

/**
 * People management for the Owner and Sheriffs: a directory of members on the
 * left and the chosen member's settings on the right. On a narrow screen the
 * settings open above the directory. It shows only the actions the viewer's
 * role allows, but that is a courtesy: each action is a database function
 * that checks the role again, needs a sign-in in the last 15 minutes, and is
 * audited. There is no money here and no raw editing.
 */
export function MemberConsole({ role, members, query, institutions, badges }: MemberConsoleProps) {
  const router = useRouter();
  const [search, setSearch] = useState(query);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = members?.find((member) => member.publicId === selectedId) ?? null;

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = search.trim();
    setSelectedId(null);
    router.push(term ? `/console/people?q=${encodeURIComponent(term)}` : "/console/people");
  }

  return (
    <div className="ops-stack">
      <section className="panel people-search" aria-labelledby="people-search">
        <div>
          <h2 className="ops-panel__title" id="people-search">
            Find a member
          </h2>
          <p className="form-field__hint">
            Signed in as {ROLE_LABEL[role]}.{" "}
            {role === "institution_sheriff"
              ? "You see members of your institution only, without their email addresses."
              : "Search by name, email address or member id."}{" "}
            Every change asks for a reason and is recorded.
          </p>
        </div>
        <form className="people-search__form" role="search" onSubmit={onSearch}>
          <label className="visually-hidden" htmlFor="member-search">
            Name, email or member id
          </label>
          <input
            className="form-field__input"
            id="member-search"
            type="search"
            placeholder="Name, email or member id"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit" className="button button--primary button--compact">
            Search
          </button>
        </form>
      </section>

      {members === null ? (
        <UiStatus
          kind="error"
          heading="Members could not be loaded"
          message="Try again in a moment."
        />
      ) : members.length === 0 ? (
        <p className="ops-empty">No members match.</p>
      ) : (
        <div className={`people${selected ? " people--open" : ""}`}>
          <section className="panel people__directory" aria-labelledby="people-directory">
            <h2 className="people__heading" id="people-directory">
              Members <span className="people__count">{members.length} shown</span>
            </h2>
            <ul className="people__list">
              {members.map((member) => (
                <li key={member.publicId}>
                  <MemberRow
                    member={member}
                    institutions={institutions}
                    selected={member.publicId === selectedId}
                    onSelect={() => setSelectedId(member.publicId)}
                  />
                </li>
              ))}
            </ul>
          </section>

          <section className="panel people__detail" aria-label="Member settings">
            {selected ? (
              <MemberDetail
                key={selected.publicId}
                member={selected}
                role={role}
                institutions={institutions}
                badges={badges.filter((badge) => !badge.retired)}
                onChanged={() => router.refresh()}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <p className="people__placeholder">
                Choose a member to see their details and settings.
              </p>
            )}
          </section>
        </div>
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

function restrictionChip(member: ConsoleMember): { text: string; tone: string } | null {
  if (member.restriction === null) return null;
  return member.restriction.expiresAt
    ? { text: "Timed out", tone: "warning" }
    : { text: "Restricted", tone: "danger" };
}

/** One member in the directory: a single button that opens their settings. */
function MemberRow({
  member,
  institutions,
  selected,
  onSelect,
}: {
  readonly member: ConsoleMember;
  readonly institutions: MemberConsoleProps["institutions"];
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const roles = describeRoles(member.roles, institutions);
  const restriction = restrictionChip(member);
  return (
    <button
      type="button"
      className="people-row"
      aria-pressed={selected}
      aria-label={`Manage ${member.displayName}`}
      onClick={onSelect}
    >
      <span className="people-row__name">
        {member.displayName}
        {member.institution?.state === "verified" ? (
          <span className="people-row__star" aria-hidden="true">
            {" "}
            ★
          </span>
        ) : null}
      </span>
      <span className="people-row__meta">
        {member.email ?? member.institution?.name ?? "No institution chosen"}
      </span>
      {roles.length || restriction || member.badge ? (
        <span className="people-row__chips">
          {roles.map((text) => (
            <span key={text} className="people-chip people-chip--info">
              {text}
            </span>
          ))}
          {restriction ? (
            <span className={`people-chip people-chip--${restriction.tone}`}>
              {restriction.text}
            </span>
          ) : null}
          {member.badge ? <span className="people-chip">{member.badge.name}</span> : null}
        </span>
      ) : null}
    </button>
  );
}

function MemberDetail({
  member,
  role,
  institutions,
  badges,
  onChanged,
  onClose,
}: {
  readonly member: ConsoleMember;
  readonly role: ConsoleRole;
  readonly institutions: MemberConsoleProps["institutions"];
  readonly badges: readonly ConsoleBadge[];
  readonly onChanged: () => void;
  readonly onClose: () => void;
}) {
  const staff = role === "owner" || role === "platform_sheriff";
  const owner = role === "owner";
  const isOwner = member.roles.includes("owner");
  const tabs: Tab[] = ["moderation"];
  if (staff) tabs.push("profile");
  if (owner) tabs.push("roles");
  const [tab, setTab] = useState<Tab>("moderation");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const roles = describeRoles(member.roles, institutions);
  const headingId = `member-${member.publicId}`;

  // Opening a member moves focus to their name, so a keyboard or screen
  // reader user lands on the settings (above the list on a phone).
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length] ?? "moderation";
    setTab(next);
    document.getElementById(`${headingId}-tab-${next}`)?.focus();
  }

  return (
    <article className="people-detail" aria-labelledby={headingId}>
      <div className="people-detail__head">
        <h3 className="ops-panel__title" id={headingId} tabIndex={-1} ref={headingRef}>
          <Link href={`/u/${member.publicId}`} prefetch={false}>
            {member.displayName}
          </Link>
        </h3>
        <button type="button" className="button button--quiet button--compact" onClick={onClose}>
          Close
        </button>
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

      {isOwner && !owner ? (
        <p className="ops-alert ops-alert--info">
          Only the Owner manages the Owner&rsquo;s account.
        </p>
      ) : (
        <>
          {tabs.length > 1 ? (
            <div className="ops-tabs" role="tablist" aria-label="Settings">
              {tabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  className="ops-tab"
                  id={`${headingId}-tab-${item}`}
                  aria-selected={tab === item}
                  aria-controls={`${headingId}-panel`}
                  tabIndex={tab === item ? 0 : -1}
                  onClick={() => setTab(item)}
                  onKeyDown={onTabKey}
                >
                  {TAB_LABEL[item]}
                </button>
              ))}
            </div>
          ) : null}
          <div
            className="people-detail__panel"
            id={`${headingId}-panel`}
            {...(tabs.length > 1
              ? { role: "tabpanel", "aria-labelledby": `${headingId}-tab-${tab}` }
              : {})}
          >
            {tab === "moderation" ? (
              <ModerationActions member={member} owner={owner} onChanged={onChanged} />
            ) : null}
            {tab === "profile" && staff ? (
              <ProfileActions member={member} onChanged={onChanged} />
            ) : null}
            {tab === "roles" && owner ? (
              <RoleActions
                member={member}
                isOwner={isOwner}
                institutions={institutions}
                badges={badges}
                onChanged={onChanged}
              />
            ) : null}
          </div>
        </>
      )}
    </article>
  );
}

function ModerationActions({
  member,
  owner,
  onChanged,
}: {
  readonly member: ConsoleMember;
  readonly owner: boolean;
  readonly onChanged: () => void;
}) {
  return (
    <>
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
      ) : (
        <p className="form-field__hint">Only the Owner can lift a permanent restriction.</p>
      )}

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
    </>
  );
}

function ProfileActions({
  member,
  onChanged,
}: {
  readonly member: ConsoleMember;
  readonly onChanged: () => void;
}) {
  return (
    <>
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
    </>
  );
}

function RoleActions({
  member,
  isOwner,
  institutions,
  badges,
  onChanged,
}: {
  readonly member: ConsoleMember;
  readonly isOwner: boolean;
  readonly institutions: MemberConsoleProps["institutions"];
  readonly badges: readonly ConsoleBadge[];
  readonly onChanged: () => void;
}) {
  return (
    <>
      {institutions.length > 0 ? (
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

      {!isOwner ? (
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
    </>
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
