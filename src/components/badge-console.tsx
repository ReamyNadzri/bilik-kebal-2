"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ConfirmIdentity } from "./confirm-identity";
import type { ConsoleBadge, ConsoleMember, ConsoleOperationCode } from "@/contracts/console";
import { callOperation } from "@/features/presentation/call-operation";

const MAX_IMAGE_BYTES = 256 * 1024;

/** Which section an action came from, so its errors and password prompt appear there. */
type Where = "create" | "list";

/**
 * The Owner designs badges and awards them to members, here or from People. A
 * badge is shown beside the member's name and never replaces the
 * institution-verified star. Images go to the public `badges` bucket, which only the Owner can
 * write; the file never passes through this app's server.
 */
export function BadgeConsole({
  badges,
  members = null,
}: {
  readonly badges: readonly ConsoleBadge[];
  /** Members the Owner can award a badge to here; null when they could not be loaded. */
  readonly members?: readonly ConsoleMember[] | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<{ text: string; where: Where } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ run: () => Promise<void>; where: Where } | null>(null);
  const [awardTo, setAwardTo] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Runs one Owner action. When the 15-minute sign-in has lapsed, the password
   * is asked for beside the section the action came from, then it is retried.
   */
  async function withStepUp(
    action: () => Promise<{ ok: boolean; code?: string; message?: string }>,
    where: Where,
    onSuccess?: () => void,
  ): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      setPending(null);
      onSuccess?.();
      router.refresh();
      return;
    }
    if (result.code === "RECENT_AUTH_REQUIRED") {
      setPending({ run: () => withStepUp(action, where, onSuccess), where });
      return;
    }
    setPending(null);
    setError({ text: result.message || "That did not work. Try again.", where });
  }

  async function create() {
    let imageKey: string | undefined;
    if (file) {
      const slot = await callOperation<
        { signedUrl: string; token: string; imageKey: string },
        ConsoleOperationCode
      >("/api/console/badges/upload-url", { contentType: file.type }, "CONSOLE_UNAVAILABLE");
      if (!slot.ok) return slot;
      const upload = await fetch(slot.data.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      }).catch(() => null);
      if (!upload?.ok) {
        return { ok: false, message: "The image could not be uploaded. Try again." };
      }
      imageKey = slot.data.imageKey;
    }
    const result = await callOperation<{ badgeId: string }, ConsoleOperationCode>(
      "/api/console/badges",
      { name: name.trim(), description: description.trim(), ...(imageKey ? { imageKey } : {}) },
      "CONSOLE_UNAVAILABLE",
    );
    if (result.ok) {
      setName("");
      setDescription("");
      setFile(null);
    }
    return result;
  }

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError({ text: "Name the badge in 2 to 40 characters.", where: "create" });
      return;
    }
    if (file && !["image/png", "image/webp"].includes(file.type)) {
      setError({ text: "Use a PNG or WebP image.", where: "create" });
      return;
    }
    if (file && file.size > MAX_IMAGE_BYTES) {
      setError({ text: "The image must be 256 KB or smaller.", where: "create" });
      return;
    }
    void withStepUp(create, "create");
  }

  /** Pins a badge to a member (replacing theirs), or takes it off with null. */
  function setMemberBadge(member: ConsoleMember, badge: ConsoleBadge, award: boolean) {
    setNotice(null);
    void withStepUp(
      () =>
        callOperation<{ done: true }, ConsoleOperationCode>(
          `/api/console/members/${encodeURIComponent(member.publicId)}`,
          { action: "set_badge", badgeId: award ? badge.id : null },
          "CONSOLE_UNAVAILABLE",
        ),
      "list",
      () => {
        setAwardTo((current) => ({ ...current, [badge.id]: "" }));
        setNotice(
          award
            ? `Awarded “${badge.name}” to ${member.displayName}.`
            : `Took “${badge.name}” off ${member.displayName}.`,
        );
      },
    );
  }

  function onAward(event: FormEvent<HTMLFormElement>, badge: ConsoleBadge) {
    event.preventDefault();
    const member = members?.find((item) => item.publicId === awardTo[badge.id]);
    if (!member) {
      setError({ text: `Choose who should wear “${badge.name}”.`, where: "list" });
      return;
    }
    setMemberBadge(member, badge, true);
  }

  function retire(badge: ConsoleBadge) {
    setNotice(null);
    void withStepUp(
      () =>
        callOperation<{ done: true }, ConsoleOperationCode>(
          `/api/console/badges/${encodeURIComponent(badge.id)}/retire`,
          {},
          "CONSOLE_UNAVAILABLE",
        ),
      "list",
      () => setNotice(`Retired “${badge.name}”.`),
    );
  }

  return (
    <div className="ops-stack">
      <section className="panel ops-panel" aria-labelledby="badge-new">
        <h2 className="ops-panel__title" id="badge-new">
          Design a badge
        </h2>
        <p className="form-field__hint">
          Owner only. It appears beside a member&rsquo;s name and is separate from the
          institution-verified star.
        </p>
        {error?.where === "create" ? (
          <p className="form-field__error" role="alert">
            {error.text}
          </p>
        ) : null}
        <form className="ops-form" onSubmit={onCreate} noValidate>
          <div className="form-field">
            <label className="form-field__label" htmlFor="badge-name">
              Name
            </label>
            <input
              className="form-field__input"
              id="badge-name"
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="badge-description">
              Description <span className="form-field__required">(optional)</span>
            </label>
            <input
              className="form-field__input"
              id="badge-description"
              maxLength={160}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="badge-image">
              Emblem image <span className="form-field__required">(optional)</span>
            </label>
            <p className="form-field__hint" id="badge-image-hint">
              PNG or WebP, square, up to 256 KB. Publicly visible. Use your own original art.
            </p>
            <input
              className="form-field__input"
              id="badge-image"
              type="file"
              accept="image/png,image/webp"
              aria-describedby="badge-image-hint"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          {pending?.where === "create" ? null : (
            <div>
              <button
                type="submit"
                className="button button--primary"
                disabled={busy || pending !== null}
              >
                {busy ? "Saving…" : "Create badge"}
              </button>
            </div>
          )}
        </form>
        {/* Outside the form: a form inside a form re-submits the outer one. */}
        {pending?.where === "create" ? (
          <ConfirmIdentity purpose="save this badge" onConfirmed={() => void pending.run()} />
        ) : null}
      </section>

      <section className="panel ops-panel" aria-labelledby="badge-list">
        <h2 className="ops-panel__title" id="badge-list">
          Badges
        </h2>
        <p className="form-field__hint">
          Award a badge here or from People. A member wears one badge at a time, so awarding
          replaces the badge they have.
          {members && members.length >= 50
            ? " The list shows the first 50 members; find anyone else in People."
            : ""}
        </p>
        {notice ? (
          <p className="ops-alert ops-alert--success" role="status">
            {notice}
          </p>
        ) : null}
        {error?.where === "list" ? (
          <p className="form-field__error" role="alert">
            {error.text}
          </p>
        ) : null}
        {pending?.where === "list" ? (
          <ConfirmIdentity purpose="change this badge" onConfirmed={() => void pending.run()} />
        ) : null}
        {badges.length === 0 ? (
          <p className="replies__empty">No badges yet.</p>
        ) : (
          <ul className="ops-list">
            {badges.map((badge) => {
              const wearers = members?.filter((member) => member.badge?.id === badge.id) ?? [];
              const selectId = `badge-award-${badge.id}`;
              return (
                <li key={badge.id} className="badge-row">
                  <div className="badge-row__head">
                    {badge.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Owner-uploaded public image.
                      <img
                        className="badge-row__image"
                        src={badge.imageUrl}
                        alt=""
                        width={36}
                        height={36}
                      />
                    ) : null}
                    <div>
                      <p className="reply__meta">
                        <strong>{badge.name}</strong>
                        {badge.retired ? " · retired" : ` · worn by ${badge.holders}`}
                      </p>
                      {badge.description ? (
                        <p className="reply__text">{badge.description}</p>
                      ) : null}
                    </div>
                  </div>

                  {badge.retired ? null : (
                    <>
                      {members === null ? (
                        <p className="form-field__hint">
                          Members could not be loaded; award this badge from People.
                        </p>
                      ) : (
                        <form
                          className="badge-row__award"
                          onSubmit={(event) => onAward(event, badge)}
                        >
                          <label className="form-field__label" htmlFor={selectId}>
                            Award to
                          </label>
                          <select
                            className="form-field__input"
                            id={selectId}
                            value={awardTo[badge.id] ?? ""}
                            onChange={(event) =>
                              setAwardTo((current) => ({
                                ...current,
                                [badge.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Choose a member</option>
                            {members
                              .filter((member) => member.badge?.id !== badge.id)
                              .map((member) => (
                                <option key={member.publicId} value={member.publicId}>
                                  {member.displayName}
                                  {member.badge ? ` (now wears ${member.badge.name})` : ""}
                                </option>
                              ))}
                          </select>
                          <button
                            type="submit"
                            className="button button--primary button--compact"
                            disabled={busy || pending !== null}
                          >
                            Award
                          </button>
                        </form>
                      )}

                      {wearers.length > 0 ? (
                        <ul className="badge-row__wearers" aria-label={`Wearing ${badge.name}`}>
                          {wearers.map((member) => (
                            <li key={member.publicId}>
                              <span>{member.displayName}</span>
                              <button
                                type="button"
                                className="button button--quiet button--compact"
                                disabled={busy || pending !== null}
                                onClick={() => setMemberBadge(member, badge, false)}
                              >
                                Remove
                                <span className="visually-hidden"> from {member.displayName}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      <div className="reply__actions">
                        <button
                          type="button"
                          className="button button--compact"
                          disabled={busy || pending !== null}
                          onClick={() => retire(badge)}
                        >
                          Retire (removes it from everyone)
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
