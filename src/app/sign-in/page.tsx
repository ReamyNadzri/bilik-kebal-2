import type { Metadata } from "next";
import { FixtureNotice } from "@/components/fixture-notice";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in | VAULTIX",
};

/** Fixture-only. Remove FixtureNotice when the authentication operation lands. */
export default function SignInPage() {
  return (
    <>
      <h1>Sign in</h1>
      <FixtureNotice screen="Sign in" />
      <SignInForm />
    </>
  );
}
