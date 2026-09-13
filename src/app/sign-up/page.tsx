import type { Metadata } from "next";
import { FixtureNotice } from "@/components/fixture-notice";
import { SignUpForm } from "@/components/sign-up-form";

export const metadata: Metadata = {
  title: "Create account | VAULTIX",
};

/** Fixture-only. Remove FixtureNotice when the registration operation lands. */
export default function SignUpPage() {
  return (
    <>
      <h1>Create an account</h1>
      <FixtureNotice screen="Create account" />
      <SignUpForm />
    </>
  );
}
