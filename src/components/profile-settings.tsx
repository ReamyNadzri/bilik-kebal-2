"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { Avatar } from "./avatar";
import { AvatarEditor } from "./avatar-editor";
import { AvatarPixelArt } from "./avatar-pixel-art";
import type { AccountViewModel } from "@/contracts";
import { ACCOUNT_DELETION_MIN_AGE_DAYS, type DisplayNameAllowance } from "@/contracts/profiles";
import type { OwnPaymentDetails } from "@/contracts/payment-details";
import { PaymentDetailsForm } from "./payment-details-form";
import { REWARD_CODE_MESSAGES, type RewardCodeOutcome } from "@/contracts/rewards";
import { TAXONOMY_CATEGORY_LABEL, type TaxonomyRequestView } from "@/contracts/taxonomy-requests";
import { isExternalAvatarUrl, presetAvatarPath, AVATAR_PRESET_COUNT } from "@/lib/avatars";
import { useAuth } from "@/features/presentation/auth/auth-provider";
import { callOperation } from "@/features/presentation/call-operation";
import { googlePhotoUrl } from "@/features/presentation/auth/google-photo";

export interface ProfileSettingsProps {
  readonly account: AccountViewModel;
  readonly bio: string | null;
  readonly entryRequests: readonly TaxonomyRequestView[] | null;
  /** Phone and bank for refunds and payouts; "unavailable" when it could not be read. */
  readonly paymentDetails?: OwnPaymentDetails | null | "unavailable";
  /** Display name changes left; null when it could not be read. */
  readonly nameAllowance?: DisplayNameAllowance | null;
  /** The reference instant for the account's age. Defaults to the clock. */
  readonly now?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** When account deletion opens: 30 days after joining. Null if the join date is unknown. */
export function deletionOpensAt(joinedAt: string | null): Date | null {
  if (joinedAt === null) return null;
  const joined = new Date(joinedAt).getTime();
  return Number.isNaN(joined) ? null : new Date(joined + ACCOUNT_DELETION_MIN_AGE_DAYS * DAY_MS);
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
export function ProfileSettings({
  account,
  bio,
  entryRequests,
  paymentDetails = null,
  nameAllowance = null,
  now,
}: ProfileSettingsProps) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { refreshAccount } = useAuth();
  const { user: clerkUser } = useUser();
  const googlePhoto = googlePhotoUrl(clerkUser);
  const [avatarUrl, setAvatarUrl] = useState(account.avatarUrl);
  const [preset, setPreset] = useState<number | null>(account.avatarPreset ?? null);
  const [pictureOpen, setPictureOpen] = useState(false);
  const [pictureNotice, setPictureNotice] = useState<Notice>(null);
  const [displayName, setDisplayName] = useState(account.displayName);
  const [draftBio, setDraftBio] = useState(bio ?? "");
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [code, setCode] = useState("");
  const [codeNotice, setCodeNotice] = useState<Notice>(null);
  const [namesLeft, setNamesLeft] = useState(nameAllowance?.remaining ?? null);
  const [busy, setBusy] = useState<"picture" | "profile" | "code" | "delete" | null>(null);
  const [deletion, setDeletion] = useState<"closed" | "too-new" | "confirm">("closed");
  const [deleteWord, setDeleteWord] = useState("");
  const [deleteNotice, setDeleteNotice] = useState<Notice>(null);
  const nameLocked = namesLeft === 0;

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

  async function chooseGooglePhoto() {
    setBusy("picture");
    setPictureNotice(null);
    const result = await callOperation<{ avatarUrl: string | null }, string>(
      "/api/profile/avatar/google",
      {},
      "PROFILE_UNAVAILABLE",
    );
    setBusy(null);
    if (!result.ok) {
      setPictureNotice({ kind: "error", text: result.message || "Your picture was not saved." });
      return;
    }
    setPreset(null);
    setAvatarUrl(result.data.avatarUrl);
    setPictureNotice({ kind: "ok", text: "Your Google photo is your picture again." });
    await refreshAccount();
    router.refresh();
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const renaming = displayName.trim() !== account.displayName;
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
    if (renaming && namesLeft !== null) setNamesLeft(Math.max(0, namesLeft - 1));
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
    setCodeNotice({
      kind: result.data.outcome === "redeemed" ? "ok" : "error",
      text: REWARD_CODE_MESSAGES[result.data.outcome],
    });
    if (result.data.outcome === "redeemed") {
      setCode("");
      // A code may add name changes; the page reads the allowance again.
      router.refresh();
    }
  }

  function askToDelete() {
    setDeleteNotice(null);
    const opens = deletionOpensAt(account.joinedAt);
    const at = now ? new Date(now).getTime() : Date.now();
    setDeletion(opens !== null && opens.getTime() > at ? "too-new" : "confirm");
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleteWord.trim().toUpperCase() !== "DELETE") return;
    setBusy("delete");
    setDeleteNotice(null);
    const result = await callOperation<{ deleted: true }, string>(
      "/api/profile/account",
      {},
      "PROFILE_UNAVAILABLE",
      "DELETE",
    );
    if (!result.ok) {
      setBusy(null);
      setDeleteNotice({
        kind: "error",
        text: result.message || "Your account could not be deleted. Try again.",
      });
      return;
    }
    await signOut({ redirectUrl: "/" }).catch(() => router.replace("/"));
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
                <img
                  src={presetAvatarPath(index)}
                  alt=""
                  width={56}
                  height={56}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </li>
          ))}
        </ul>
        {/* Only for a member signed in with Google, and only while another picture is shown. */}
        {googlePhoto && !isExternalAvatarUrl(avatarUrl) ? (
          <button
            type="button"
            className="button button--secondary button--compact hunter-card__upload"
            onClick={() => void chooseGooglePhoto()}
            disabled={busy !== null}
          >
            Use my Google photo
          </button>
        ) : null}
        <button
          type="button"
          className="button button--secondary button--compact hunter-card__upload"
          onClick={() => setPictureOpen(true)}
          disabled={busy !== null}
        >
          Upload your own photo
        </button>
        <AvatarPixelArt
          disabled={busy !== null}
          onError={(text) => setPictureNotice({ kind: "error", text })}
          onSaved={async (url) => {
            setAvatarUrl(url);
            setPreset(null);
            setPictureNotice({ kind: "ok", text: "Pixel picture saved." });
            await refreshAccount();
            router.refresh();
          }}
        />
        {account.publicId ? (
          <Link className="hunter-card__public" href={`/u/${account.publicId}`}>
            View your public profile
          </Link>
        ) : null}
      </section>

      <div className="profile-settings__main">
        <form className="panel profile-card" onSubmit={saveProfile} noValidate>
          <h2 className="profile-card__title">Your details</h2>
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
                readOnly={nameLocked}
                aria-readonly={nameLocked || undefined}
                aria-describedby={namesLeft === null ? undefined : "profile-display-name-hint"}
                onChange={(event) => setDisplayName(event.target.value)}
              />
              {/* Under the input, so it lines up with the email beside it. */}
              {namesLeft === null ? null : (
                <p
                  className="form-field__hint form-field__hint--after"
                  id="profile-display-name-hint"
                >
                  {nameLocked
                    ? "You have used your name changes. A name change code adds more."
                    : `You can change it ${namesLeft} more time${namesLeft === 1 ? "" : "s"}.`}
                </p>
              )}
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
                        : "confirmed automatically through your university email domain."
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

        <PaymentDetailsForm details={paymentDetails} />

        <form
          className="panel profile-card"
          id="reward-code"
          onSubmit={redeem}
          aria-labelledby="reward-code-heading"
          noValidate
        >
          <h2 id="reward-code-heading">Redeem Code</h2>
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
                Removes your name, picture, bio and bank details for good and signs you out. Payment
                and audit records are kept, without your name, as the law requires.
              </p>
            </div>
            {deletion === "closed" ? (
              <button
                type="button"
                className="button button--danger-outline button--compact"
                onClick={askToDelete}
              >
                Delete account
              </button>
            ) : null}
          </div>

          {deletion === "too-new" ? (
            <p className="ops-alert ops-alert--error" role="alert">
              Your account can be deleted from{" "}
              {DATE.format(deletionOpensAt(account.joinedAt) ?? new Date())}, 30 days after it was
              created.
            </p>
          ) : null}

          {deletion === "confirm" ? (
            <form className="delete-account" onSubmit={deleteAccount} noValidate>
              <NoticeLine notice={deleteNotice} />
              <div className="form-field">
                <label className="form-field__label" htmlFor="delete-account-word">
                  Type DELETE to confirm. This cannot be undone.
                </label>
                <input
                  className="form-field__input"
                  id="delete-account-word"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={deleteWord}
                  onChange={(event) => setDeleteWord(event.target.value)}
                />
              </div>
              <div className="profile-form__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => {
                    setDeletion("closed");
                    setDeleteWord("");
                  }}
                  disabled={busy === "delete"}
                >
                  Keep my account
                </button>
                <button
                  type="submit"
                  className="button button--danger-outline"
                  disabled={busy !== null || deleteWord.trim().toUpperCase() !== "DELETE"}
                >
                  {busy === "delete" ? "Deleting…" : "Delete my account"}
                </button>
              </div>
            </form>
          ) : null}
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
