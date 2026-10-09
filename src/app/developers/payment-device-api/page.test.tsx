import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import PaymentDeviceApiPage, { metadata } from "./page";

test("asks search engines not to index or follow it", () => {
  expect(metadata.robots).toEqual({ index: false, follow: false });
});

test("says the API is a draft that is not live", () => {
  render(<PaymentDeviceApiPage />);

  expect(screen.getByRole("heading", { level: 1, name: "Payment device API" })).toBeInTheDocument();
  expect(screen.getByText("Draft v1, not live")).toBeInTheDocument();
  expect(screen.getByRole("note", { name: "Status" })).toHaveTextContent(
    "They do not exist on the server yet",
  );
});

test("documents both endpoints and every observation field", () => {
  render(<PaymentDeviceApiPage />);

  expect(screen.getByText("/api/payment-devices/v1/observations")).toBeInTheDocument();
  expect(screen.getByText("/api/payment-devices/v1/health")).toBeInTheDocument();
  for (const field of ["eventId", "notificationKeyDigest", "amountSen", "category"]) {
    expect(screen.getAllByText(field, { selector: "code" }).length).toBeGreaterThan(0);
  }
});

test("never presents an accepted observation as a confirmed payment", () => {
  render(<PaymentDeviceApiPage />);

  const accepted = screen.getByText("202 Accepted").closest("li");
  expect(accepted).not.toBeNull();
  expect(within(accepted as HTMLElement).getByText(/not a payment/)).toBeInTheDocument();
  expect(screen.getByText("An observation is evidence, never a confirmation.")).toBeInTheDocument();
});

test("every section in the contents list exists on the page", () => {
  const { container } = render(<PaymentDeviceApiPage />);

  const links = within(screen.getByRole("navigation", { name: "On this page" })).getAllByRole(
    "link",
  );
  for (const link of links) {
    const target = link.getAttribute("href")?.slice(1) ?? "";
    expect(container.querySelector(`#${target}`)).not.toBeNull();
  }
});
