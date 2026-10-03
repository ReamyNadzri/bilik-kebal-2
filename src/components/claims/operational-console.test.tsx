import { render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { RefundTaskView } from "@/contracts/payouts";
import { OperationalConsole } from "./operational-console";

const pendingRefund: RefundTaskView = {
  id: "refund-1",
  wantedRequestId: "wanted-1",
  contributionId: "contrib-1",
  contributorUserId: "u-backer-1",
  contributorDisplayName: "Farid Backer",
  amountSen: 2000,
  feeSen: 200,
  // A Platform Sheriff gets no bank details: the database answers only the Owner.
  recipient: null,
  status: "pending",
  externalReference: null,
  refundMethod: null,
  evidenceNotes: null,
  completedAt: null,
  ownerUserId: null,
  createdAt: "2026-10-03T10:00:00Z",
};

function stubQueues(refunds: RefundTaskView[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () => ({ ok: true, data: url.includes("refunds") ? refunds : [] }),
      }),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

test("opens on the payouts queue by default", async () => {
  stubQueues([pendingRefund]);
  render(<OperationalConsole />);
  expect(await screen.findByRole("tab", { name: "Refunds (1 pending)" })).toHaveAttribute(
    "aria-selected",
    "false",
  );
  expect(screen.getByRole("tab", { name: /Payouts/ })).toHaveAttribute("aria-selected", "true");
});

test("a refund notice's link opens the refunds queue with its pending rows", async () => {
  stubQueues([pendingRefund]);
  render(<OperationalConsole initialTab="refunds" />);

  const tab = await screen.findByRole("tab", { name: "Refunds (1 pending)" });
  expect(tab).toHaveAttribute("aria-selected", "true");
  const panel = screen.getByRole("tabpanel");
  expect(within(panel).getByText("Farid Backer")).toBeInTheDocument();
  expect(within(panel).getByText("Pending", { selector: ".status-stamp" })).toBeInTheDocument();
});

test("a Sheriff sees pending refunds but not the Owner-only Process refund button", async () => {
  stubQueues([pendingRefund]);
  render(<OperationalConsole initialTab="refunds" />);
  expect(await screen.findByText("Farid Backer")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /process refund/i })).not.toBeInTheDocument();
  expect(screen.getByText("Recorded by the Owner")).toBeInTheDocument();
});

test("the Owner gets the Process refund button", async () => {
  stubQueues([pendingRefund]);
  render(<OperationalConsole initialTab="refunds" isOwner />);
  expect(await screen.findByRole("button", { name: /process refund/i })).toBeInTheDocument();
});
