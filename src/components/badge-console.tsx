"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ConfirmIdentity } from "./confirm-identity";
import type { ConsoleBadge, ConsoleOperationCode } from "@/contracts/console";
import { callOperation } from "@/features/presentation/call-operation";

const MAX_IMAGE_BYTES = 256 * 1024;

/**
 * The Owner designs badges and pins them to members from People. A badge is
 * shown beside the member's name and never replaces the institution-verified
 * star. Images go to the public `badges` bucket, which only the Owner can
 * write; the file never passes through this app's server.
 */
export function BadgeConsole({ badges }: { readonly badges: readonly ConsoleBadge[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<(() => Promise<void>) | null>(null);

  async function withStepUp(
    action: () => Promise<{ ok: boolean; code?: string; message?: string }>,
  ) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      setPending(null);
      router.refresh();
      return true;
    }
    if (result.code === "RECENT_AUTH_REQUIRED") {
      setPending(() => async () => {
        await withStepUp(action);
      });
      return false;
    }
    setError(result.message || "That did not work. Try again.");
    return false;
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
      setError("Name the badge in 2 to 40 characters.");
      return;
    }
    if (file && !["image/png", "image/webp"].includes(file.type)) {
      setError("Use a PNG or WebP image.");
      return;
    }
    if (file && file.size > MAX_IMAGE_BYTES) {
      setError("The image must be 256 KB or smaller.");
      return;
    }
    void withStepUp(create);
  }

  function retire(badge: ConsoleBadge) {
    void withStepUp(() =>
      callOperation<{ done: true }, ConsoleOperationCode>(
        `/api/console/badges/${encodeURIComponent(badge.id)}/retire`,
        {},
        "CONSOLE_UNAVAILABLE",
      ),
    );
  }

  return (
    <div className="ops-stack">
      <section className="panel ops-panel" aria-labelledby="badge-new">
        <h2 className="ops-panel__title" id="badge-new">
          Design a badge
        </h2>
        <p className="form-field__hint">
          Owner only. Pin a badge to a member from People. It appears beside their name and is
          separate from the institution-verified star.
        </p>
        {error ? (
          <p className="form-field__error" role="alert">
            {error}
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
          {pending ? (
            <ConfirmIdentity purpose="save this badge" onConfirmed={() => void pending()} />
          ) : (
            <div>
              <button type="submit" className="button button--primary" disabled={busy}>
                {busy ? "Saving…" : "Create badge"}
              </button>
            </div>
          )}
        </form>
      </section>

      <section className="panel ops-panel" aria-labelledby="badge-list">
        <h2 className="ops-panel__title" id="badge-list">
          Badges
        </h2>
        {badges.length === 0 ? (
          <p className="replies__empty">No badges yet.</p>
        ) : (
          <ul className="ops-list">
            {badges.map((badge) => (
              <li key={badge.id} className="reply">
                {badge.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Owner-uploaded public image.
                  <img src={badge.imageUrl} alt="" width={36} height={36} />
                ) : null}
                <div className="reply__body">
                  <p className="reply__meta">
                    <strong>{badge.name}</strong>
                    {badge.retired ? " · retired" : ` · worn by ${badge.holders}`}
                  </p>
                  {badge.description ? <p className="reply__text">{badge.description}</p> : null}
                  {badge.retired ? null : (
                    <div className="reply__actions">
                      <button
                        type="button"
                        className="button button--compact"
                        disabled={busy}
                        onClick={() => retire(badge)}
                      >
                        Retire (removes it from everyone)
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
