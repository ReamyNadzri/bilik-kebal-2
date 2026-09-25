"use client";

import { useState } from "react";
import { useAuth } from "@/features/presentation/auth/auth-provider";

export interface SignOutButtonProps {
  readonly className?: string;
  readonly label?: string;
}

/**
 * Ends the session through the shared auth provider, the same path the shell's
 * account menu takes. A refused sign-out keeps the viewer where they are and
 * says so, rather than navigating away as if the session had ended.
 */
export function SignOutButton({
  className = "auth-form__submit",
  label = "Sign out",
}: SignOutButtonProps) {
  const { signOut, state } = useAuth();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={handleSignOut}
        disabled={busy}
        aria-disabled={busy ? true : undefined}
      >
        {busy ? "Signing out…" : label}
      </button>
      {state.error === null ? null : (
        <span className="account-menu__error" role="alert">
          {state.error}
        </span>
      )}
    </>
  );
}
