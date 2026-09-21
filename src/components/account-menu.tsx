"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/features/presentation/auth/auth-provider";
import { signInPathFor } from "@/features/presentation/auth/redirect-target";

/**
 * Who is signed in, and the way out.
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

  return (
    <div className="account-menu">
      <span className="account-menu__name">
        <span className="visually-hidden">Signed in as </span>
        {state.account.displayName}
      </span>

      <button
        className="button button--quiet account-menu__action"
        type="button"
        onClick={handleSignOut}
        disabled={busy}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>

      {state.error === null ? null : (
        <p className="account-menu__error" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
