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

  it("keeps only digits when text is typed or pasted into the account number", () => {
    render(<PaymentDetailsForm details={null} />);

    const input = screen.getByLabelText("Account number");
    fireEvent.change(input, { target: { value: "1234-56 78ab90" } });

    expect(input).toHaveValue("1234567890");
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
      accountNumber: "112233446789",
      bankCode: "maybank",
      phone: "0123456789",
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
    fireEvent.change(screen.getByLabelText("Account number"), {
      target: { value: "112233446789" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save payment details" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Check your payment details.");
    expect(screen.getByLabelText("Mobile number")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Enter a Malaysian mobile number/)).toBeInTheDocument();
  });

  it("takes digits only in the mobile number", () => {
    render(<PaymentDetailsForm details={null} />);
    const phone = screen.getByLabelText("Mobile number");

    fireEvent.change(phone, { target: { value: "+60 12-abc 345 6789" } });

    expect(phone).toHaveValue("60123456789");
    expect(phone).toHaveAttribute("inputmode", "numeric");
  });

  it("shows saved details and lets the member change them", () => {
    render(<PaymentDetailsForm details={saved} />);

    expect(screen.getByText("012-345 6789")).toBeInTheDocument();
    expect(screen.getByText("Maybank")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change payment details" }));
    expect(screen.getByLabelText("Mobile number")).toHaveValue("0123456789");
    expect(screen.getByLabelText("Account number")).toHaveValue("");
    expect(screen.getByText(/saved one ends in 6789/)).toBeInTheDocument();
  });

  it("keeps every digit of a dashed account number pasted whole", () => {
    render(<PaymentDetailsForm details={null} />);

    const input = screen.getByLabelText("Account number");
    // The browser cuts a paste at maxLength before onChange strips the dashes.
    expect(Number(input.getAttribute("maxLength"))).toBeGreaterThanOrEqual(40);
    fireEvent.change(input, { target: { value: "1234-5678-9012-3456-78" } });

    expect(input).toHaveValue("123456789012345678");
  });

  it("refuses an account number longer than 20 digits instead of cutting it", () => {
    render(<PaymentDetailsForm details={null} />);

    const input = screen.getByLabelText("Account number");
    fireEvent.change(input, { target: { value: "1234567890123456789012" } });
    expect(input).toHaveValue("1234567890123456789012");
    fireEvent.click(screen.getByRole("button", { name: "Save payment details" }));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter the account number: 6 to 20 digits.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Check your payment details.");
  });

  it("refuses an account number shorter than 6 digits", () => {
    render(<PaymentDetailsForm details={null} />);

    fireEvent.change(screen.getByLabelText("Account number"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Save payment details" }));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByText("Enter the account number: 6 to 20 digits.")).toBeInTheDocument();
  });
});
