"use client";

import { useEffect, useState } from "react";
import type { PayoutTaskView, RefundTaskView } from "@/contracts/payouts";
import { OwnerPayoutQueue } from "./owner-payout-queue";
import { OwnerRefundQueue } from "./owner-refund-queue";

type Tab = "payouts" | "refunds" | "expiry";

export function OperationalConsole() {
  const [activeTab, setActiveTab] = useState<Tab>("payouts");
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

      if (payoutsRes.ok && payoutsData.ok) {
        setPayouts(payoutsData.data);
      } else {
        setError(payoutsData.error ?? "Failed to load payout tasks.");
      }

      if (refundsRes.ok && refundsData.ok) {
        setRefunds(refundsData.data);
      }
    } catch {
      setError("Unable to connect to operational services.");
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
      const res = await fetch(`/api/marketplace/wanted/${expireWantedId.trim()}/expire`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setExpiryMessage(
          `Bounty expired successfully. Generated ${data.data.refundsCreated} contributor refund task(s).`,
        );
        setExpireWantedId("");
        void loadData();
      } else {
        setExpiryError(data.error ?? "Unable to expire bounty.");
      }
    } catch {
      setExpiryError("Network error attempting to expire bounty.");
    } finally {
      setIsExpiring(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="Operations Queues"
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: "2px solid var(--border-default, #9c8558)",
          paddingBottom: "0.25rem",
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "payouts"}
          onClick={() => setActiveTab("payouts")}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.9rem",
            fontWeight: activeTab === "payouts" ? 700 : 500,
            background: activeTab === "payouts" ? "var(--bg-surface, #fbf3e0)" : "transparent",
            border: activeTab === "payouts" ? "1px solid var(--border-default, #9c8558)" : "none",
            borderBottom: "none",
            borderRadius: "4px 4px 0 0",
            cursor: "pointer",
            color: "var(--text-primary, #2a2118)",
          }}
        >
          💰 Payout Queue ({payouts.filter((p) => p.status === "pending").length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "refunds"}
          onClick={() => setActiveTab("refunds")}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.9rem",
            fontWeight: activeTab === "refunds" ? 700 : 500,
            background: activeTab === "refunds" ? "var(--bg-surface, #fbf3e0)" : "transparent",
            border: activeTab === "refunds" ? "1px solid var(--border-default, #9c8558)" : "none",
            borderBottom: "none",
            borderRadius: "4px 4px 0 0",
            cursor: "pointer",
            color: "var(--text-primary, #2a2118)",
          }}
        >
          🔄 Refund Queue ({refunds.filter((r) => r.status === "pending").length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "expiry"}
          onClick={() => setActiveTab("expiry")}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.9rem",
            fontWeight: activeTab === "expiry" ? 700 : 500,
            background: activeTab === "expiry" ? "var(--bg-surface, #fbf3e0)" : "transparent",
            border: activeTab === "expiry" ? "1px solid var(--border-default, #9c8558)" : "none",
            borderBottom: "none",
            borderRadius: "4px 4px 0 0",
            cursor: "pointer",
            color: "var(--text-primary, #2a2118)",
          }}
        >
          ⏳ Bounty Expiry Tool
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "4px",
            background: "rgba(183, 28, 28, 0.1)",
            border: "1px solid var(--state-error, #b71c1c)",
            color: "var(--state-error, #b71c1c)",
            fontSize: "0.85rem",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Tab Panels */}
      {activeTab === "payouts" && (
        <OwnerPayoutQueue tasks={payouts} isLoading={isLoading} onRefresh={loadData} />
      )}

      {activeTab === "refunds" && (
        <OwnerRefundQueue tasks={refunds} isLoading={isLoading} onRefresh={loadData} />
      )}

      {activeTab === "expiry" && (
        <section
          className="panel"
          aria-labelledby="expiry-tool-heading"
          style={{
            borderRadius: "4px",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <div>
            <h2
              id="expiry-tool-heading"
              style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-primary, #2a2118)" }}
            >
              ⏳ Bounty Expiry &amp; Refund Generation
            </h2>
            <p
              style={{
                margin: "0.25rem 0 0 0",
                fontSize: "0.85rem",
                color: "var(--text-muted, #5e4f37)",
              }}
            >
              Expire bounties whose duration has elapsed without an approved claim. Generates
              individual contributor refund tasks without modifying the historical ledger.
            </p>
          </div>

          {expiryMessage && (
            <div
              role="status"
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: "4px",
                background: "rgba(46, 125, 50, 0.1)",
                border: "1px solid var(--state-success, #2e7d32)",
                color: "var(--state-success, #2e7d32)",
                fontSize: "0.85rem",
              }}
            >
              ✓ {expiryMessage}
            </div>
          )}

          {expiryError && (
            <div
              role="alert"
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: "4px",
                background: "rgba(183, 28, 28, 0.1)",
                border: "1px solid var(--state-error, #b71c1c)",
                color: "var(--state-error, #b71c1c)",
                fontSize: "0.85rem",
              }}
            >
              ⚠️ {expiryError}
            </div>
          )}

          <form
            onSubmit={handleExpireBounty}
            style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "500px" }}
          >
            <div>
              <label
                htmlFor="expire-wanted-id"
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  marginBottom: "0.25rem",
                }}
              >
                Wanted Request UUID
              </label>
              <input
                id="expire-wanted-id"
                type="text"
                required
                value={expireWantedId}
                onChange={(e) => setExpireWantedId(e.target.value)}
                placeholder="e.g. 74000000-0000-4000-8000-000000000001"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "4px",
                  border: "1px solid var(--border-default, #9c8558)",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isExpiring}
              className="button button--secondary"
              style={{ alignSelf: "flex-start", padding: "0.5rem 1rem", fontSize: "0.85rem" }}
            >
              {isExpiring ? "Processing Expiry..." : "Expire Bounty & Generate Refunds"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
