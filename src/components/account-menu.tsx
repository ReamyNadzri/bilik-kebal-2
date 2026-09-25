"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

  if (state.account === null) {
    return (
      <Link className="button button--quiet account-menu__action" href={signInPathFor(pathname)}>
        Sign in
      </Link>
    );
  }

  async function handleSignOut() {
    setBusy(true);
    await signOut();
    setBusy(false);
  }

  const account = state.account;
  const institutionVerified = account.trust.institution === "verified";
  const status = institutionVerified
    ? "Institution verified"
    : account.trust.email === "verified"
      ? "Email verified"
      : "Email not verified";

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
        <Avatar src={account.avatarUrl} size={36} className="account-chip__avatar" />
        <span className="account-chip__text">
          <span className="account-menu__name">
            <span className="visually-hidden">Signed in as </span>
            {account.displayName}
            {institutionVerified ? (
              <span className="account-chip__star" aria-hidden="true">
                {" "}
                ★
              </span>
            ) : null}
          </span>
          <span className="account-chip__status">{status}</span>
        </span>
      </button>

      <div className="account-chip__menu" id="account-chip-menu">
        {account.publicId ? (
          <Link className="account-chip__item" href={`/u/${account.publicId}`}>
            View my profile
          </Link>
        ) : null}
        <Link className="account-chip__item" href="/profile">
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
