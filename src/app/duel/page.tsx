import type { Metadata } from "next";
import Link from "next/link";
import { DuelGame } from "@/components/duel/duel-game";
import { UiStatus } from "@/components/ui-status";
import { requireAccount } from "@/features/presentation/auth/require-account";
import { loadDuelLobby } from "@/modules/duel/loaders/duel-operations";

export const metadata: Metadata = {
  title: "Duel | VAULTIX",
  description: "A quick-draw duel against other hunters' ghosts.",
};

/** The member's own record; never cached. */
export const dynamic = "force-dynamic";

export default async function DuelPage() {
  const outcome = await requireAccount("/duel");
  if (outcome.kind === "unavailable") {
    return (
      <div className="panel">
        <h1>Duel</h1>
        <UiStatus
          kind="error"
          heading="The Duel is unavailable"
          message="Your account could not be read just now. Try again in a moment."
        />
      </div>
    );
  }

  const lobby = await loadDuelLobby();
  if (!lobby.ok) {
    return (
      <div className="panel">
        <h1>Duel</h1>
        {lobby.code === "EMAIL_NOT_VERIFIED" ? (
          <UiStatus
            kind="restricted"
            heading="Verify your email to duel"
            message="Duels are recorded against your account, so your email needs to be verified first."
            action={<Link href="/verify-email">Verify your email</Link>}
          />
        ) : (
          <UiStatus kind="error" heading="The Duel is unavailable" message={lobby.message} />
        )}
      </div>
    );
  }

  const { account } = outcome;
  return (
    <div className="page-bare duel-page">
      <DuelGame
        initialLobby={lobby.data}
        playerName={account.displayName}
        playerPicture={account.avatarUrl}
      />
    </div>
  );
}
