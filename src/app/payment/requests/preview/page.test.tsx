import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
vi.mock("next/navigation", () => ({ notFound }));

const { default: PaymentRequestPreviewPage } = await import("./page");

async function renderWith(params: Record<string, string>) {
  render(await PaymentRequestPreviewPage({ searchParams: Promise.resolve(params) }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  notFound.mockClear();
});

test("marks itself as a development fixture and defaults to the ready state", async () => {
  await renderWith({});

  expect(screen.getByText("Development only")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ready to pay" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("heading", { name: "Pay to publish your Wanted" })).toBeInTheDocument();
});

test("picks a fixture from the state parameter and ignores unknown values", async () => {
  await renderWith({ state: "confirmed-back" });
  expect(screen.getByRole("heading", { name: "Contribution confirmed." })).toBeInTheDocument();
});

test("falls back to the ready state for an unknown value", async () => {
  await renderWith({ state: "paid" });
  expect(screen.getByRole("link", { name: "Ready to pay" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("is not reachable in a production build", async () => {
  vi.stubEnv("NODE_ENV", "production");

  await expect(renderWith({})).rejects.toThrow("NEXT_NOT_FOUND");
  expect(notFound).toHaveBeenCalled();
});
