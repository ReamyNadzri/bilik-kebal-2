"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { Avatar } from "./avatar";
import { useAuth } from "@/features/presentation/auth/auth-provider";
import { signInPathFor } from "@/features/presentation/auth/redirect-target";

/**
 * Who is signed in, and the way out.
 *
 * Signed in, the rail shows a chip — picture, name, star for institution
 * verification and the trust state in words. Hovering it, focusing into it or
 * pressing it opens View my profile, Edit profile and Sign out. The items stay
 * in the document and the tab order, so keyboard and screen-reader users reach
 * them without needing the hover.
 *
 * Sign-out is a button inside a form-less action rather than a link because it
 * changes server state; a link would invite a prefetch to end the session.
 *
 * The signed-out branch carries the current path forward so signing in returns
 * the viewer to the screen they were reading rather than to a generic landing
 * page.
 */
export function AccountMenu() {
  const { signOut, state } = useAuth();
  const { user, isSignedIn } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const pathname = usePathname() ?? "";
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  if (state.status === "loading") {
    return (
      <p className="account-menu__pending" aria-live="polite">
        Checking your account…
      </p>
    );
  }

  const isUserSignedIn = state.account !== null || Boolean(isSignedIn && user);

  if (!isUserSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link className="button button--quiet account-menu__action" href={signInPathFor(pathname)}>
          Sign in
        </Link>
        <Link
          className="button button--quiet account-menu__action account-menu__signup"
          href="/sign-up"
        >
          Sign up
        </Link>
      </div>
    );
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      if (clerkSignOut) {
        await clerkSignOut();
      }
    } catch {
      // Best-effort Clerk sign-out
    }
    try {
      await signOut();
    } catch {
      // Best-effort Auth sign-out
    }
    setBusy(false);
  }

  const account = state.account;
  const displayName =
    account?.displayName ??
    user?.fullName ??
    user?.firstName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress ??
    "Member";
  const avatarUrl = account?.avatarUrl ?? user?.imageUrl ?? null;
  const email = account?.email ?? user?.primaryEmailAddress?.emailAddress ?? null;
  const institutionVerified = account?.trust.institution === "verified";
  const status = institutionVerified
    ? "Institution verified"
    : account?.trust.email === "verified" || isSignedIn
      ? "Email verified"
      : "Email not verified";
  const publicId = account?.publicId ?? null;

  return (
    <div
      className={`account-chip${open ? " account-chip--open" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="account-chip__trigger"
        aria-expanded={open}
        aria-controls="account-chip-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar src={avatarUrl} size={36} className="account-chip__avatar" />
        <span className="account-chip__text">
          <span className="account-menu__name">
            <span className="visually-hidden">Signed in as </span>
            {displayName}
            {institutionVerified ? (
              <span className="account-chip__star" aria-hidden="true">
                {" "}
                ★
              </span>
            ) : null}
          </span>
          <span className="account-chip__status">{status}</span>
        </span>
        <span className="account-chip__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      <div className="account-chip__menu" id="account-chip-menu">
        {email ? (
          <div className="account-chip__header">
            <span className="account-chip__header-name">{displayName}</span>
            <span className="account-chip__email">{email}</span>
          </div>
        ) : null}
        {publicId ? (
          <Link
            className="account-chip__item"
            href={`/u/${publicId}`}
            onClick={() => setOpen(false)}
          >
            View my profile
          </Link>
        ) : null}
        <Link className="account-chip__item" href="/profile" onClick={() => setOpen(false)}>
          Edit profile
        </Link>
        <button
          className="account-chip__item account-chip__item--danger"
          type="button"
          onClick={handleSignOut}
          disabled={busy}
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>

      {state.error === null ? null : (
        <p className="account-menu__error" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}

/**
 * The signed-in viewer as the compact header and menu show them, by the same
 * rules as `AccountMenu`: signed in when either the app account or the Clerk
 * session says so, with Clerk's name and picture standing in until the
 * account record has loaded.
 */
function useCompactViewer() {
  const { signOut, state } = useAuth();
  const { user, isSignedIn } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  if (state.status === "loading") return { kind: "loading" } as const;
  if (state.account === null && !(isSignedIn && user)) return { kind: "guest" } as const;

  const account = state.account;
  const institutionVerified = account?.trust.institution === "verified";

  async function signOutEverywhere() {
    try {
      if (clerkSignOut) await clerkSignOut();
    } catch {
      // Best-effort Clerk sign-out
    }
    try {
      await signOut();
    } catch {
      // Best-effort Auth sign-out
    }
  }

  return {
    kind: "member",
    displayName:
      account?.displayName ??
      user?.fullName ??
      user?.firstName ??
      user?.username ??
      user?.primaryEmailAddress?.emailAddress ??
      "Member",
    avatarUrl: account?.avatarUrl ?? user?.imageUrl ?? null,
    institutionVerified,
    status: institutionVerified
      ? "Institution verified"
      : account?.trust.email === "verified" || isSignedIn
        ? "Email verified"
        : "Email not verified",
    error: state.error,
    signOutEverywhere,
  } as const;
}

/**
 * The compact header's account controls (design_handoff_vaultix_mobile, §1).
 *
 * Signed in: an Inbox link carrying the unread count, and the avatar, which
 * leads to the profile. Signed out: a Sign in button, on tablets only — a
 * phone reaches it in the menu. Sign-out itself lives in the menu, away from
 * the thumb's path along the header.
 */
export function CompactAccount({ unreadCount = null }: { readonly unreadCount?: number | null }) {
  const viewer = useCompactViewer();
  const pathname = usePathname() ?? "";

  if (viewer.kind === "loading") return null;

  if (viewer.kind === "guest") {
    return (
      <Link className="shell-compact__control shell-compact__tablet" href={signInPathFor(pathname)}>
        Sign in
      </Link>
    );
  }

  const unread = unreadCount ?? 0;

  return (
    <>
      <Link className="shell-compact__control shell-compact__inbox" href="/notifications">
        Inbox
        {unread > 0 ? (
          <span className="shell-compact__badge">
            <span aria-hidden="true">{unread > 99 ? "99+" : unread}</span>
            <span className="visually-hidden">{`, ${unread} unread`}</span>
          </span>
        ) : null}
      </Link>
      <Link className="shell-compact__avatar" href="/profile" aria-label="Your profile">
        <Avatar src={viewer.avatarUrl} size={34} />
      </Link>
    </>
  );
}

/**
 * The account block at the foot of the compact menu: a profile card and
 * Sign out, or Sign in and Create account for a guest.
 */
export function MenuAccount() {
  const viewer = useCompactViewer();
  const pathname = usePathname() ?? "";
  const [busy, setBusy] = useState(false);

  if (viewer.kind === "loading") {
    return (
      <p className="shell-menu__pending" aria-live="polite">
        Checking your account…
      </p>
    );
  }

  if (viewer.kind === "guest") {
    return (
      <div className="shell-menu__guest">
        <Link className="shell-menu__sign-in" href={signInPathFor(pathname)}>
          Sign in
        </Link>
        <Link className="button button--brass shell-menu__create" href="/sign-up">
          Create account
        </Link>
      </div>
    );
  }

  const { signOutEverywhere } = viewer;

  async function handleSignOut() {
    setBusy(true);
    await signOutEverywhere();
    setBusy(false);
  }

  return (
    <>
      <div className="shell-menu__member">
        <Link className="shell-menu__profile" href="/profile">
          <Avatar src={viewer.avatarUrl} size={38} className="shell-menu__profile-avatar" />
          <span className="shell-menu__profile-text">
            <span className="shell-menu__profile-name">
              <span className="visually-hidden">Signed in as </span>
              {viewer.displayName}
              {viewer.institutionVerified ? (
                <span className="account-chip__star" aria-hidden="true">
                  {" "}
                  ★
                </span>
              ) : null}
            </span>
            <span className="shell-menu__profile-status">{viewer.status}</span>
          </span>
        </Link>
        <button
          className="shell-menu__sign-out"
          type="button"
          onClick={handleSignOut}
          disabled={busy}
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
      {viewer.error === null ? null : (
        <p className="account-menu__error" role="alert">
          {viewer.error}
        </p>
      )}
    </>
  );
}
