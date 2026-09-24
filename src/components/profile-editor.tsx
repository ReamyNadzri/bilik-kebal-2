"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Avatar } from "./avatar";
import { AvatarEditor } from "./avatar-editor";
import { ProfileHeader } from "./profile-header";
import type { AccountViewModel } from "@/contracts";
import { useAuth } from "@/features/presentation/auth/auth-provider";
import { callOperation } from "@/features/presentation/call-operation";

export interface ProfileEditorProps {
  readonly account: AccountViewModel;
  readonly bio: string | null;
  readonly postedCount: number;
}

/**
 * The member's own profile: the public header they share with everyone, plus
 * the controls to change their picture, display name and bio. Saving refreshes
 * the shell's account chip so the new name and picture appear everywhere.
 */
export function ProfileEditor({ account, bio, postedCount }: ProfileEditorProps) {
  const router = useRouter();
  const { refreshAccount } = useAuth();
  const [editing, setEditing] = useState(false);
  const [pictureOpen, setPictureOpen] = useState(false);
  const [displayName, setDisplayName] = useState(account.displayName);
  const [draftBio, setDraftBio] = useState(bio ?? "");
  const [savedBio, setSavedBio] = useState(bio);
  const [avatarUrl, setAvatarUrl] = useState(account.avatarUrl);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const result = await callOperation<{ displayName: string; bio: string | null }, string>(
      "/api/profile",
      { displayName, bio: draftBio },
      "PROFILE_UNAVAILABLE",
      "PATCH",
    );
    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.message || "Your profile could not be saved." });
      return;
    }
    setSavedBio(result.data.bio);
    setDisplayName(result.data.displayName);
    setEditing(false);
    setStatus({ kind: "ok", text: "Profile saved." });
    await refreshAccount();
    router.refresh();
  }

  async function onRemovePicture() {
    setBusy(true);
    const result = await callOperation<{ avatarUrl: string | null }, string>(
      "/api/profile/avatar",
      { objectKey: null },
      "PROFILE_UNAVAILABLE",
    );
    setBusy(false);
    if (result.ok) {
      setAvatarUrl(null);
      await refreshAccount();
    } else {
      setStatus({ kind: "error", text: result.message || "Your picture could not be removed." });
    }
  }

  return (
    <>
      <ProfileHeader
        displayName={displayName}
        avatarUrl={avatarUrl}
        bio={savedBio}
        joinedAt={account.joinedAt}
        institutionName={account.institution?.name ?? null}
        institutionVerified={account.trust.institution === "verified"}
        stats={[{ label: "Requests posted", value: String(postedCount) }]}
        avatarSlot={
          <button
            type="button"
            className="profile-header__picture-button"
            onClick={() => setPictureOpen(true)}
            aria-label="Change your picture"
          >
            <Avatar src={avatarUrl} size={132} className="profile-header__avatar" />
            <span className="profile-header__picture-hint" aria-hidden="true">
              Change
            </span>
          </button>
        }
        actions={
          <span className="profile-header__actions">
            <button
              type="button"
              className="button button--secondary button--compact"
              aria-expanded={editing}
              aria-controls="profile-edit-form"
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? "Cancel editing" : "Edit profile"}
            </button>
            {account.publicId ? (
              <Link
                className="button button--quiet button--compact"
                href={`/u/${account.publicId}`}
              >
                View public profile
              </Link>
            ) : null}
          </span>
        }
      />

      {status ? (
        <p
          className={`ops-alert ${status.kind === "ok" ? "ops-alert--success" : "ops-alert--error"}`}
          role={status.kind === "ok" ? "status" : "alert"}
        >
          {status.text}
        </p>
      ) : null}

      {editing ? (
        <form
          id="profile-edit-form"
          className="panel ops-form profile-form"
          onSubmit={onSave}
          noValidate
        >
          <div className="form-field">
            <label className="form-field__label" htmlFor="profile-display-name">
              Display name <span className="form-field__required">(required)</span>
            </label>
            <p className="form-field__hint" id="profile-display-name-hint">
              2 to 40 characters. This is how other members see you.
            </p>
            <input
              className="form-field__input"
              id="profile-display-name"
              type="text"
              maxLength={40}
              value={displayName}
              aria-describedby="profile-display-name-hint"
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="profile-bio">
              Bio <span className="form-field__required">(optional)</span>
            </label>
            <p className="form-field__hint" id="profile-bio-hint">
              Up to 160 characters, shown on your public profile. Do not include phone numbers.
            </p>
            <textarea
              className="form-field__input"
              id="profile-bio"
              rows={3}
              maxLength={160}
              value={draftBio}
              aria-describedby="profile-bio-hint"
              onChange={(event) => setDraftBio(event.target.value)}
            />
          </div>
          <div className="dialog__actions">
            {avatarUrl ? (
              <button
                type="button"
                className="button button--danger-outline"
                onClick={() => void onRemovePicture()}
                disabled={busy}
              >
                Remove picture
              </button>
            ) : null}
            <button type="submit" className="button button--primary" disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      ) : null}

      {pictureOpen ? (
        <AvatarEditor
          onClose={() => setPictureOpen(false)}
          onSaved={async (url) => {
            setAvatarUrl(url);
            setPictureOpen(false);
            setStatus({ kind: "ok", text: "Picture saved." });
            await refreshAccount();
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
