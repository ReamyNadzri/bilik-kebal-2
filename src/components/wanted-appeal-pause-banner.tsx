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
      className="mb-6 rounded-xl border border-amber-600/40 bg-amber-950/30 p-4 text-amber-200 shadow-md backdrop-blur-sm"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">
          ⏸️
        </span>
        <div>
          <h4 className="text-sm font-bold text-amber-100">Bounty Countdown & Refunds Paused</h4>
          <p className="mt-1 text-xs text-amber-300/90 leading-relaxed">
            A rejected claim on this Wanted request is currently undergoing formal 7-day appeal
            review by an independent Sheriff. Expiry countdowns and refund disbursements are paused.
            Once the appeal is resolved, the remaining bounty duration will be extended accordingly.
          </p>
          {totalPausedDurationText ? (
            <p className="mt-2 text-xs font-medium text-amber-400">
              Total appeal time paused so far: {totalPausedDurationText}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
