import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import PaymentReturnPage from "./page";

async function renderWith(params: Record<string, string>) {
  render(await PaymentReturnPage({ searchParams: Promise.resolve(params) }));
}

test("never reports a payment as confirmed from the redirect alone", async () => {
  await renderWith({ status_id: "1", billcode: "abc123", order_id: "order-9" });

  expect(screen.getByText("Waiting for the payment provider to confirm")).toBeInTheDocument();
  expect(screen.queryByText(/payment (was )?successful|paid/i)).not.toBeInTheDocument();
  expect(screen.getByText(/does not confirm a payment/)).toBeInTheDocument();
});

test("does not echo the provider's bill code or order reference", async () => {
  await renderWith({ status_id: "1", billcode: "abc123", order_id: "order-9" });

  expect(document.body.textContent).not.toMatch(/abc123|order-9/);
});

test("says the bounty is unchanged when the provider reports a failed checkout", async () => {
  await renderWith({ status_id: "3" });

  expect(screen.getByText("The payment did not go through")).toBeInTheDocument();
  expect(screen.getByText(/bounty has not changed/)).toBeInTheDocument();
});
