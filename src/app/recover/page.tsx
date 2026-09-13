import type { Metadata } from "next";
import { FixtureNotice } from "@/components/fixture-notice";
import { RecoverForm } from "@/components/recover-form";

export const metadata: Metadata = {
  title: "Recover your password | VAULTIX",
};

/** Fixture-only. Remove FixtureNotice when the recovery operation lands. */
export default function RecoverPage() {
  return (
    <>
      <h1>Recover your password</h1>
      <FixtureNotice screen="Password recovery" />
      <RecoverForm />
    </>
  );
}
