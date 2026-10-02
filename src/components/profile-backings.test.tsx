import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import type { ClosedBacking, Sen } from "@/contracts/marketplace";
import { ProfileBackings } from "./profile-backings";

const closed = (overrides: Partial<ClosedBacking>): ClosedBacking => ({
  publicId: "p-1",
  title: "Past year papers for MAT183",
  reason: "withdrawn",
  refundState: "pending",
  refundSen: 2200 as Sen,
  backedAt: "2026-10-03T01:00:00Z",
  ...overrides,
});

function renderBackings(items: ClosedBacking[]) {
  render(
    <ProfileBackings
      backings={{ live: [], closed: items }}
      now="2026-10-03T00:00:00Z"
      empty="nothing"
    />,
  );
  return within(screen.getByRole("list", { name: "Closed Wanteds you backed" }));
}

test("a withdrawn Wanted stays listed with its pending refund, not as a link", () => {
  const list = renderBackings([closed({})]);
  expect(list.getByText("Past year papers for MAT183")).toBeInTheDocument();
  expect(
    list.getByText("Withdrawn by the poster · Refund of RM 22.00 pending"),
  ).toBeInTheDocument();
  expect(list.queryByRole("link")).toBeNull();
  expect(screen.getByRole("region", { name: "Wanteds you backed" })).toBeInTheDocument();
  expect(document.getElementById("profile-backed-heading")).toHaveTextContent("Wanteds you backed");
});

test("names the Owner's removal, a refunded expiry and a late payment", () => {
  const list = renderBackings([
    closed({ publicId: "p-r", title: "Removed request title", reason: "removed" }),
    closed({
      publicId: "p-e",
      title: "Expired request title",
      reason: "expired",
      refundState: "refunded",
      refundSen: 1100 as Sen,
    }),
    closed({
      publicId: "p-c",
      title: "Closed request title",
      reason: "closed",
      refundSen: 330 as Sen,
    }),
  ]);
  expect(list.getByText("Removed by the Owner · Refund of RM 22.00 pending")).toBeInTheDocument();
  expect(list.getByText("Expired without a winner · Refunded RM 11.00")).toBeInTheDocument();
  expect(
    list.getByText("Closed before your payment arrived · Refund of RM 3.30 pending"),
  ).toBeInTheDocument();
  // An expired Wanted still has its public page.
  expect(list.getByRole("link", { name: "Expired request title" })).toHaveAttribute(
    "href",
    "/wanted/p-e",
  );
  expect(list.getByText("Refunded")).toHaveClass("status-stamp--success");
  expect(list.getAllByText("Refund pending")[0]).toHaveClass("status-stamp--warning");
});

test("says plainly when no refund has been queued", () => {
  const list = renderBackings([closed({ refundState: "none", refundSen: 0 as Sen })]);
  expect(list.getByText("Withdrawn by the poster · No refund queued yet")).toBeInTheDocument();
});

test("shows the empty state only when nothing at all was backed", () => {
  render(
    <ProfileBackings
      backings={{ live: [], closed: [] }}
      now="2026-10-03T00:00:00Z"
      empty="none yet"
    />,
  );
  expect(screen.getByText("none yet")).toBeInTheDocument();
  expect(screen.queryByRole("list")).toBeNull();
});
