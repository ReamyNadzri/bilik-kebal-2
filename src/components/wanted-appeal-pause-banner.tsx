"use client";

interface WantedAppealPauseBannerProps {
  isPaused: boolean;
  totalPausedDurationText?: string;
}

export function WantedAppealPauseBanner({
  isPaused,
  totalPausedDurationText,
}: WantedAppealPauseBannerProps) {
  if (!isPaused) return null;

  return (
    <aside
      role="status"
      aria-label="Bounty Paused Notice"
      className="dispatch-banner dispatch-banner--warning"
    >
      <div className="dispatch-banner__head">
        <h4 className="dispatch-banner__title">Bounty Countdown & Refunds Paused</h4>
        <span className="dispatch-banner__tag">Appeal open</span>
      </div>
      <p className="dispatch-banner__message">
        A rejected claim on this Wanted request is under a 7-day appeal with a different Sheriff.
        The expiry countdown and any refunds are paused. When the appeal is decided, the remaining
        time is extended by the paused time.
      </p>
      {totalPausedDurationText ? (
        <p className="dispatch-banner__message">
          <strong>Paused so far: {totalPausedDurationText}</strong>
        </p>
      ) : null}
    </aside>
  );
}
