import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { UiStatus } from "@/components/ui-status";

export const metadata: Metadata = {
  title: "Sign out | VAULTIX",
};

export const dynamic = "force-dynamic";

export default function SignOutPage() {
  return (
    <div className="page-bare">
      <div className="panel page-heading">
        <div>
          <h1>Sign out</h1>
          <p className="page-heading__lede">End your current session on this device.</p>
        </div>
      </div>

      <div className="panel">
        <UiStatus
          kind="restricted"
          heading="Sign out of VAULTIX"
          message="Click the button below to end your session, or return to your profile."
          action={
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <SignOutButton />
              <Link className="button button--secondary" href="/profile">
                Return to Profile
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
}
