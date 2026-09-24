"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { PayoutTaskView, RefundTaskView } from "@/contracts/payouts";
import { OwnerPayoutQueue } from "./owner-payout-queue";
import { OwnerRefundQueue } from "./owner-refund-queue";

type Tab = "payouts" | "refunds" | "expiry";

const TABS: readonly Tab[] = ["payouts", "refunds", "expiry"];

/** Reads an operation's refusal, whichever field the route used for it. */
function refusalMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as { message?: unknown; error?: unknown };
    if (typeof record.message === "string" && record.message !== "") return record.message;
    if (typeof record.error === "string" && record.error !== "") return record.error;
  }
  return fallback;
}

export function OperationalConsole() {
  const [activeTab, setActiveTab] = useState<Tab>("payouts");
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    payouts: null,
    refunds: null,
    expiry: null,
  });
  const [payouts, setPayouts] = useState<PayoutTaskView[]>([]);
  const [refunds, setRefunds] = useState<RefundTaskView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expiry trigger state
  const [expireWantedId, setExpireWantedId] = useState("");
  const [isExpiring, setIsExpiring] = useState(false);
  const [expiryMessage, setExpiryMessage] = useState<string | null>(null);
  const [expiryError, setExpiryError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [payoutsRes, refundsRes] = await Promise.all([
        fetch("/api/sheriff/payouts", { cache: "no-store" }),
        fetch("/api/sheriff/refunds", { cache: "no-store" }),
      ]);

      const [payoutsData, refundsData] = await Promise.all([payoutsRes.json(), refundsRes.json()]);

      const problems: string[] = [];
      if (payoutsRes.ok && payoutsData.ok) {
        setPayouts(payoutsData.data);
      } else {
        problems.push(refusalMessage(payoutsData, "Payout tasks could not be loaded."));
      }

      if (refundsRes.ok && refundsData.ok) {
        setRefunds(refundsData.data);
      } else {
        problems.push(refusalMessage(refundsData, "Refund tasks could not be loaded."));
      }

      if (problems.length > 0) setError(problems.join(" "));
    } catch {
      setError("The operations queues could not be reached. Nothing was changed. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleExpireBounty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expireWantedId.trim()) return;

    setIsExpiring(true);
    setExpiryMessage(null);
    setExpiryError(null);

    try {
      const res = await fetch(
        `/api/marketplace/wanted/${encodeURIComponent(expireWantedId.trim())}/expire`,
        {
          method: "POST",
        },
      );
      const data = await res.json();
      if (res.ok && data.ok) {
        setExpiryMessage(
          `Bounty expired. ${data.data.refundsCreated} contributor refund task(s) were added to the refund queue.`,
        );
        setExpireWantedId("");
        void loadData();
      } else {
        setExpiryError(refusalMessage(data, "This bounty could not be expired."));
      }
    } catch {
      setExpiryError("VAULTIX could not be reached, so nothing was changed. Try again.");
    } finally {
      setIsExpiring(false);
    }
  };

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.indexOf(activeTab);
    let next: Tab | undefined;
    if (event.key === "ArrowRight") next = TABS[(index + 1) % TABS.length];
    else if (event.key === "ArrowLeft") next = TABS[(index - 1 + TABS.length) % TABS.length];
    else if (event.key === "Home") next = TABS[0];
    else if (event.key === "End") next = TABS[TABS.length - 1];
    if (!next) return;
    event.preventDefault();
    setActiveTab(next);
    tabRefs.current[next]?.focus();
  }

  const pendingPayouts = payouts.filter((p) => p.status === "pending").length;
  const pendingRefunds = refunds.filter((r) => r.status === "pending").length;
  const labels: Record<Tab, string> = {
    payouts: `Payouts (${pendingPayouts} pending)`,
    refunds: `Refunds (${pendingRefunds} pending)`,
    expiry: "Bounty expiry",
  };

  return (
    <div className="ops-console">
      <div role="tablist" aria-label="Operations queues" className="ops-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            ref={(node) => {
              tabRefs.current[tab] = node;
            }}
            type="button"
            role="tab"
            id={`ops-tab-${tab}`}
            aria-controls={`ops-panel-${tab}`}
            aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={handleTabKeyDown}
            className="ops-tab"
          >
            {labels[tab]}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="ops-alert ops-alert--error">
          {error}
        </p>
      )}

      <div role="tabpanel" id={`ops-panel-${activeTab}`} aria-labelledby={`ops-tab-${activeTab}`}>
        {activeTab === "payouts" && (
          <OwnerPayoutQueue tasks={payouts} isLoading={isLoading} onRefresh={loadData} />
        )}

        {activeTab === "refunds" && (
          <OwnerRefundQueue tasks={refunds} isLoading={isLoading} onRefresh={loadData} />
        )}

        {activeTab === "expiry" && (
          <section className="panel ops-panel" aria-labelledby="expiry-tool-heading">
            <div className="ops-panel__head">
              <div>
                <h2 id="expiry-tool-heading" className="ops-panel__title">
                  Expire a bounty and create refunds
                </h2>
                <p className="ops-panel__lede">
                  For a Wanted whose duration has ended without an approved claim. Expiring it adds
                  one refund task per contribution. The ledger history is not changed.
                </p>
              </div>
            </div>

            {expiryMessage && (
              <p role="status" className="ops-alert ops-alert--success">
                {expiryMessage}
              </p>
            )}

            {expiryError && (
              <p role="alert" className="ops-alert ops-alert--error">
                {expiryError}
              </p>
            )}

            <form onSubmit={handleExpireBounty} className="ops-form ops-form--narrow">
              <div className="form-field">
                <label htmlFor="expire-wanted-id" className="form-field__label">
                  Wanted request ID
                </label>
                <input
                  id="expire-wanted-id"
                  className="form-field__input"
                  type="text"
                  required
                  spellCheck={false}
                  autoComplete="off"
                  value={expireWantedId}
                  onChange={(e) => setExpireWantedId(e.target.value)}
                  placeholder="e.g. 74000000-0000-4000-8000-000000000001"
                />
              </div>

              <div>
                <button type="submit" disabled={isExpiring} className="button button--secondary">
                  {isExpiring ? "Expiring…" : "Expire bounty and create refunds"}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
