export interface FixtureNoticeProps {
  /** Name of the screen, shown so the marker is traceable in review. */
  screen?: string;
}

/**
 * Development-only marker for screens still backed by fixtures.
 *
 * Required by docs/superpowers/plans/2026-09-13-vaultix-mvp-coordination.md §5:
 * a screen built before its backend operation exists must say so visibly.
 * Remove the marker in the same slice that switches the screen to the real
 * Codex-owned operation.
 */
export function FixtureNotice({ screen }: FixtureNoticeProps) {
  return (
    <aside className="fixture-notice" role="note">
      <p className="fixture-notice__label">Development only</p>
      <p className="fixture-notice__message">
        {screen === undefined ? "This screen" : screen} shows development fixture data and is not
        connected to a live operation. Nothing here reflects a real account, bounty or payment.
      </p>
    </aside>
  );
}
