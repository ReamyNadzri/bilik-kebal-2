"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Avatar } from "./avatar";
import { AvatarEditor } from "./avatar-editor";
import type { AccountViewModel } from "@/contracts";
import type { FreeRequestAllowance } from "@/contracts/marketplace";
import { REWARD_CODE_MESSAGES, type RewardCodeOutcome } from "@/contracts/rewards";
import { TAXONOMY_CATEGORY_LABEL, type TaxonomyRequestView } from "@/contracts/taxonomy-requests";
import { presetAvatarPath, AVATAR_PRESET_COUNT } from "@/lib/avatars";
import { useAuth } from "@/features/presentation/auth/auth-provider";
import { callOperation } from "@/features/presentation/call-operation";

export interface ProfileSettingsProps {
  readonly account: AccountViewModel;
  readonly bio: string | null;
  readonly allowance: FreeRequestAllowance | null;
  readonly entryRequests: readonly TaxonomyRequestView[] | null;
}

const PRESETS = Array.from({ length: AVATAR_PRESET_COUNT }, (_, index) => index);
const DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });
const ENTRY_STATE: Record<TaxonomyRequestView["state"], string> = {
  pending: "Waiting for a Sheriff",
  approved: "Added",
  rejected: "Not added",
};

type Notice = { readonly kind: "ok" | "error"; readonly text: string } | null;

function NoticeLine({ notice }: { readonly notice: Notice }) {
  if (notice === null) return null;
  return (
    <p
      className={`ops-alert ${notice.kind === "ok" ? "ops-alert--success" : "ops-alert--error"}`}
      role={notice.kind === "ok" ? "status" : "alert"}
    >
      {notice.text}
    </p>
  );
}

/**
 * The member's own settings: their Hunter picture (one of twelve drawn
 * characters, or their own photo), display name and bio, verification, reward
 * codes and the list entries they asked a Sheriff to add. The email address is
 * shown to the member only and cannot be changed here.
 */
export function ProfileSettings({ account, bio, allowance, entryRequests }: ProfileSettingsProps) {
  const router = useRouter();
  const { refreshAccount } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState(account.avatarUrl);
  const [preset, setPreset] = useState<number | null>(account.avatarPreset ?? null);
  const [pictureOpen, setPictureOpen] = useState(false);
  const [pictureNotice, setPictureNotice] = useState<Notice>(null);
  const [displayName, setDisplayName] = useState(account.displayName);
  const [draftBio, setDraftBio] = useState(bio ?? "");
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [code, setCode] = useState("");
  const [codeNotice, setCodeNotice] = useState<Notice>(null);
  const [remaining, setRemaining] = useState(allowance?.remaining ?? null);
  const [busy, setBusy] = useState<"picture" | "profile" | "code" | null>(null);

  const dirty = displayName.trim() !== account.displayName || draftBio.trim() !== (bio ?? "");
  const institutionVerified = account.trust.institution === "verified";
  const request = account.latestVerificationRequest;

  async function choosePreset(next: number) {
    setBusy("picture");
    setPictureNotice(null);
    const result = await callOperation<{ avatarUrl: string | null }, string>(
      "/api/profile/avatar/preset",
      { preset: next },
      "PROFILE_UNAVAILABLE",
    );
    setBusy(null);
    if (!result.ok) {
      setPictureNotice({ kind: "error", text: result.message || "Your avatar was not saved." });
      return;
    }
    setPreset(next);
    setAvatarUrl(result.data.avatarUrl);
    setPictureNotice({ kind: "ok", text: "Avatar saved." });
    await refreshAccount();
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("profile");
    setProfileNotice(null);
    const result = await callOperation<{ displayName: string; bio: string | null }, string>(
      "/api/profile",
      { displayName, bio: draftBio },
      "PROFILE_UNAVAILABLE",
      "PATCH",
    );
    setBusy(null);
    if (!result.ok) {
      setProfileNotice({ kind: "error", text: result.message || "Your profile was not saved." });
      return;
    }
    setDisplayName(result.data.displayName);
    setDraftBio(result.data.bio ?? "");
    setProfileNotice({ kind: "ok", text: "Profile saved." });
    await refreshAccount();
    router.refresh();
  }

  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("code");
    setCodeNotice(null);
    const result = await callOperation<{ outcome: RewardCodeOutcome; remaining: number }, string>(
      "/api/profile/reward-code",
      { code },
      "REWARDS_UNAVAILABLE",
    );
    setBusy(null);
    if (!result.ok) {
      setCodeNotice({ kind: "error", text: result.message || "That code could not be checked." });
      return;
    }
    setRemaining(result.data.remaining);
    setCodeNotice({
      kind: result.data.outcome === "redeemed" ? "ok" : "error",
      text: REWARD_CODE_MESSAGES[result.data.outcome],
    });
    if (result.data.outcome === "redeemed") setCode("");
  }

  return (
    <div className="profile-settings">
      <section className="panel hunter-card" aria-labelledby="hunter-card-heading">
        <p className="pixel-label" id="hunter-card-heading">
          Your Hunter
        </p>
        <Avatar
          src={avatarUrl}
          alt={`${displayName}'s avatar`}
          size={186}
          className="hunter-card__portrait"
        />

        <h2 className="hunter-card__heading">Choose an avatar</h2>
        <NoticeLine notice={pictureNotice} />
        <ul className="hunter-card__presets" aria-label="Drawn avatars">
          {PRESETS.map((index) => (
            <li key={index}>
              <button
                type="button"
                className="hunter-card__preset"
                aria-pressed={preset === index}
                aria-label={`Drawn avatar ${index + 1}`}
                disabled={busy !== null}
                onClick={() => void choosePreset(index)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- fixed 56 px pixel art */}
                <img src={presetAvatarPath(index)} alt="" width={56} height={56} />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="button button--secondary button--compact hunter-card__upload"
          onClick={() => setPictureOpen(true)}
          disabled={busy !== null}
        >
          Upload your own photo
        </button>
        {account.publicId ? (
          <Link className="hunter-card__public" href={`/u/${account.publicId}`}>
            View your public profile
          </Link>
        ) : null}
      </section>

      <div className="profile-settings__main">
        <form className="panel profile-card" onSubmit={saveProfile} noValidate>
          <h1 className="profile-card__title">Profile</h1>
          <NoticeLine notice={profileNotice} />
          <div className="profile-form__grid">
            <div className="form-field">
              <label className="form-field__label" htmlFor="profile-display-name">
                Display name
              </label>
              <input
                className="form-field__input"
                id="profile-display-name"
                type="text"
                maxLength={40}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="profile-email">
                Email address
              </label>
              <input
                className="form-field__input"
                id="profile-email"
                type="email"
                value={account.email ?? ""}
                readOnly
                aria-readonly="true"
              />
            </div>
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="profile-bio">
              Bio <span className="form-field__required">(optional)</span>
            </label>
            <textarea
              className="form-field__input"
              id="profile-bio"
              rows={2}
              maxLength={160}
              value={draftBio}
              onChange={(event) => setDraftBio(event.target.value)}
            />
          </div>
          <p className="profile-card__hint">
            Other students see your display name, avatar and bio, never your email address.
          </p>
          {dirty ? (
            <div className="profile-form__actions">
              <button type="submit" className="button button--primary" disabled={busy !== null}>
                {busy === "profile" ? "Saving…" : "Save profile"}
              </button>
            </div>
          ) : null}
        </form>

        <section className="panel profile-card" aria-labelledby="verification-heading">
          <h2 id="verification-heading">Verification</h2>
          <div className="trust-row">
            <div>
              <p className="trust-row__title">Email verified</p>
              <p className="trust-row__body">Lets you browse the Board.</p>
            </div>
            {account.trust.email === "verified" ? (
              <span className="status-stamp status-stamp--success">Verified</span>
            ) : (
              <Link className="button button--compact button--secondary" href="/verify-email">
                Verify email
              </Link>
            )}
          </div>
          <div className="trust-row">
            <div>
              <p className="trust-row__title">
                Institution verified{" "}
                {institutionVerified ? <span aria-hidden="true">★</span> : null}
              </p>
              <p className="trust-row__body">
                {institutionVerified
                  ? `${account.institution?.name ?? "Your institution"}, ${
                      request?.state === "approved"
                        ? "confirmed by a Sheriff after reviewing your evidence."
                        : "confirmed automatically through your UiTM email domain."
                    }`
                  : account.trust.institution === "pending"
                    ? "Your evidence is waiting for a Sheriff. It is stored privately."
                    : "Lets you post, back and claim Wanteds, and download approved resources."}
              </p>
            </div>
            {institutionVerified ? (
              <span className="status-stamp status-stamp--success">Institution verified</span>
            ) : account.trust.institution === "pending" ? (
              <span className="status-stamp status-stamp--warning">Awaiting review</span>
            ) : (
              <Link
                className="button button--compact button--secondary"
                href="/profile/institution-verification"
              >
                Verify institution
              </Link>
            )}
          </div>
          <p className="profile-card__hint">
            Institution verification confirms affiliation only. It does not guarantee resource
            quality.
          </p>
        </section>

        <form
          className="panel profile-card"
          id="reward-code"
          onSubmit={redeem}
          aria-labelledby="reward-code-heading"
          noValidate
        >
          <h2 id="reward-code-heading">Free requests</h2>
          <p className="profile-card__hint">
            {remaining === null
              ? "Every member can post 3 free requests."
              : `You have ${remaining} free request${remaining === 1 ? "" : "s"} left.`}{" "}
            A reward code adds more. Each code works once per member.
          </p>
          <NoticeLine notice={codeNotice} />
          <div className="reward-code">
            <div className="form-field">
              <label className="form-field__label" htmlFor="reward-code-input">
                Reward code
              </label>
              <input
                className="form-field__input"
                id="reward-code-input"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={32}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <button
              type="submit"
              className="button button--primary"
              disabled={busy !== null || code.trim() === ""}
            >
              {busy === "code" ? "Checking…" : "Redeem"}
            </button>
          </div>
        </form>

        <section
          className="panel profile-card"
          id="entry-requests"
          aria-labelledby="entry-requests-heading"
        >
          <h2 id="entry-requests-heading">Entries you asked for</h2>
          {entryRequests === null ? (
            <p className="profile-card__hint">Your requests could not be loaded right now.</p>
          ) : entryRequests.length === 0 ? (
            <p className="profile-card__hint">
              When a campus, course or tag is missing from Post a Wanted, choose &ldquo;Ask a
              Sheriff to add it&rdquo;. Your requests and their decisions appear here.
            </p>
          ) : (
            <ul className="entry-list">
              {entryRequests.map((item) => (
                <li className="entry-list__item" key={item.id}>
                  <div>
                    <p className="trust-row__title">
                      {item.courseCode ? `${item.courseCode} ` : ""}
                      {item.label}
                    </p>
                    <p className="trust-row__body">
                      {TAXONOMY_CATEGORY_LABEL[item.category]} · asked{" "}
                      {DATE.format(new Date(item.createdAt))}
                      {item.decisionNote ? ` · Sheriff: ${item.decisionNote}` : ""}
                    </p>
                  </div>
                  <span
                    className={`status-stamp ${
                      item.state === "approved"
                        ? "status-stamp--success"
                        : item.state === "rejected"
                          ? "status-stamp--danger"
                          : "status-stamp--warning"
                    }`}
                  >
                    {ENTRY_STATE[item.state]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel profile-card" aria-labelledby="delete-account-heading">
          <div className="trust-row trust-row--plain">
            <div>
              <h2 className="trust-row__title" id="delete-account-heading">
                Delete account
              </h2>
              <p className="trust-row__body">
                Not available yet. Ledger and audit records must be kept as the law requires, so
                account deletion is waiting on a retention decision.
              </p>
            </div>
          </div>
        </section>
      </div>

      {pictureOpen ? (
        <AvatarEditor
          onClose={() => setPictureOpen(false)}
          onSaved={async (url) => {
            setAvatarUrl(url);
            setPreset(null);
            setPictureOpen(false);
            setPictureNotice({ kind: "ok", text: "Photo saved." });
            await refreshAccount();
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
