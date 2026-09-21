"use client";

import { useState } from "react";

export interface SignOutButtonProps {
  readonly className?: string;
  readonly label?: string;
}

export function SignOutButton({
  className = "auth-form__submit",
  label = "Sign out",
}: SignOutButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } finally {
      window.location.href = "/sign-in";
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleSignOut}
      disabled={busy}
      aria-disabled={busy ? true : undefined}
    >
      {busy ? "Signing out..." : label}
    </button>
  );
}
