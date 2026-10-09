/**
 * The server's clock, seen from this page.
 *
 * Every room read carries the server's time. The best estimate of the gap
 * between the two clocks comes from the quickest round trip, assuming the
 * reply was stamped halfway through it. Reactions never depend on this: each
 * member's reaction is measured from the SHOOT! their own page showed.
 */
export class ServerClock {
  private offset: number | null = null;
  private bestTrip = Number.POSITIVE_INFINITY;

  /** `sentAt` and `receivedAt` are `Date.now()` values around the request. */
  observe(serverNow: number, sentAt: number, receivedAt: number): void {
    const trip = Math.max(0, receivedAt - sentAt);
    // A slow trip says little; keep the quickest, but let it age a little so drift is followed.
    if (this.offset !== null && trip > this.bestTrip * 1.5 + 20) return;
    this.bestTrip = Math.min(this.bestTrip, trip) + 1;
    this.offset = serverNow - (sentAt + trip / 2);
  }

  get known(): boolean {
    return this.offset !== null;
  }

  /** A server moment (ms since the epoch) as a `performance.now()` value. */
  toLocal(serverMs: number, nowEpoch = Date.now(), nowPerf = performance.now()): number {
    return nowPerf + (serverMs - (this.offset ?? 0) - nowEpoch);
  }
}
