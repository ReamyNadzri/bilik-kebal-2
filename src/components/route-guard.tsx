"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { UiStatus } from "./ui-status";
import { useAuth } from "@/features/presentation/auth/auth-provider";
import type { AccountCapability } from "@/features/presentation/auth/auth-state";
import { signInPathFor } from "@/features/presentation/auth/redirect-target";

export interface RouteGuardProps {
  readonly children: ReactNode;
  /**
   * A published capability the viewer must hold. Omitted means "signed in is
   * enough".
   */
  readonly capability?: AccountCapability | undefined;
  /** What the guarded area is, used in the refusal wording. */
  readonly describe: string;
}

const CAPABILITY_REQUIREMENT: Record<AccountCapability, string> = {
  browseMetadata: "Confirm your email address to browse requests.",
  transact:
    "Institution verification is needed before you can put money into a bounty. A Sheriff reviews your evidence first.",
  submitClaim:
    "Institution verification is needed before you can submit a Claim. A Sheriff reviews your evidence first.",
  download:
    "Institution verification is needed before you can download a resource. A Sheriff reviews your evidence first.",
};

/**
 * Guards a client subtree that must not render for the wrong viewer.
 *
 * This guard refuses in place rather than redirecting. A redirect decided in
 * the browser is the flash it was supposed to prevent — the page has already
 * rendered by then. Whole protected routes are redirected on the server
 * instead (src/features/presentation/auth/require-account.ts); this is for
 * panels sitting inside a page that is otherwise public.
 *
 * Refusing to render is not access control. Every operation inside these
 * panels authorises again on the server (context/architecture.md).
 */
export function RouteGuard({ capability, children, describe }: RouteGuardProps) {
  const { can, state } = useAuth();
  const pathname = usePathname() ?? "";

  if (state.status === "loading") {
    return <UiStatus kind="loading" heading={`Checking your account before showing ${describe}`} />;
  }

  if (state.status === "unauthenticated") {
    return (
      <UiStatus
        kind="restricted"
        heading={`Sign in to use ${describe}`}
        message={state.error ?? "This part of VAULTIX is only available once you are signed in."}
        action={<Link href={signInPathFor(pathname)}>Sign in</Link>}
      />
    );
  }

  if (capability !== undefined && !can(capability)) {
    return (
      <UiStatus
        kind="restricted"
        heading={`Your account cannot use ${describe} yet`}
        message={CAPABILITY_REQUIREMENT[capability]}
        action={<Link href="/profile/institution-verification">Get verified</Link>}
      />
    );
  }

  return <>{children}</>;
}
