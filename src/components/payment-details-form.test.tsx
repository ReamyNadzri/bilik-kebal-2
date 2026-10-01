import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnPaymentDetails } from "@/contracts/payment-details";
import { PaymentDetailsForm } from "./payment-details-form";

const saved: OwnPaymentDetails = {
  accountHolderName: "Aminah Binti Ali",
  accountNumberLast4: "6789",
  bankCode: "maybank",
  bankName: "Maybank",
  phone: "+60123456789",
  updatedAt: "2026-09-30T10:00:00.000Z",
};

function respond(body: unknown, status = 200) {
  vi.mocked(global.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("PaymentDetailsForm", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("asks for phone, bank, holder and account number when none are on file", () => {
    render(<PaymentDetailsForm details={null} />);

    expect(screen.getByRole("heading", { name: "Payment details" })).toBeInTheDocument();
    expect(screen.getByLabelText("Mobile number")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Bank" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Maybank" })).toBeInTheDocument();
    expect(screen.getByLabelText("Account holder name")).toBeInTheDocument();
    expect(screen.getByLabelText("Account number")).toBeInTheDocument();
    expect(screen.getByText(/before you pay for a Wanted/)).toBeInTheDocument();
  });

  it("saves with PUT and shows only the last four digits back", async () => {
    respond({ ok: true, data: saved });
    render(<PaymentDetailsForm details={null} />);

    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "012-345 6789" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Bank" }), {
      target: { value: "maybank" },
    });
    fireEvent.change(screen.getByLabelText("Account holder name"), {
      target: { value: "Aminah Binti Ali" },
    });
    fireEvent.change(screen.getByLabelText("Account number"), {
      target: { value: "1122 3344 6789" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save payment details" }));

    expect(await screen.findByText("Payment details saved.")).toBeInTheDocument();
    const [path, init] = vi.mocked(global.fetch).mock.calls[0]!;
    expect(path).toBe("/api/profile/payment-details");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({
      accountHolderName: "Aminah Binti Ali",
      accountNumber: "1122 3344 6789",
      bankCode: "maybank",
      phone: "012-345 6789",
    });
    const list = screen.getByLabelText("Saved payment details");
    expect(within(list).getByText("6789")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("112233446789");
    expect(document.body.textContent).not.toContain("1122 3344");
  });

  it("names the fields the server refused", async () => {
    respond(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Check your payment details.",
        fieldErrors: { phone: ["Enter a Malaysian mobile number, for example 012-345 6789."] },
      },
      422,
    );
    render(<PaymentDetailsForm details={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Save payment details" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Check your payment details.");
    expect(screen.getByLabelText("Mobile number")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Enter a Malaysian mobile number/)).toBeInTheDocument();
  });

  it("shows saved details and lets the member change them", () => {
    render(<PaymentDetailsForm details={saved} />);

    expect(screen.getByText("012-345 6789")).toBeInTheDocument();
    expect(screen.getByText("Maybank")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change payment details" }));
    expect(screen.getByLabelText("Mobile number")).toHaveValue("012-345 6789");
    expect(screen.getByLabelText("Account number")).toHaveValue("");
    expect(screen.getByText(/saved one ends in 6789/)).toBeInTheDocument();
  });
});
