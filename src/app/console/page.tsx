import type { Metadata } from "next";
import { ConsoleLanding } from "@/components/console-landing";
import { FixtureNotice } from "@/components/fixture-notice";
import { VIEWER } from "@/features/presentation/fixtures/account";

export const metadata: Metadata = {
  title: "Sheriff Console | VAULTIX",
};

/**
 * Fixture-only. The fixture viewer holds no Sheriff role, so this renders the
 * refusal path. Remove FixtureNotice when the console operations land.
 */
export default function ConsolePage() {
  return (
    <>
      <h1>Sheriff Console</h1>

      <FixtureNotice screen="Sheriff Console" />

      <ConsoleLanding hasConsoleAccess={VIEWER.hasConsoleAccess} />
    </>
  );
}
