import { fireEvent, render, screen } from "@testing-library/react";
import { sen } from "@/features/marketplace/money";
import { PaymentWalkthrough, type WalkthroughSeed } from "./payment-walkthrough";

const seed: WalkthroughSeed = {
  mode: "publish",
  title: "Past year papers for MAT183",
  courseCode: "MAT183",
  courseName: "Calculus I",
  startingBountySen: sen(0),
  amountSen: sen(1500),
  feeRateBasisPoints: 1000,
  durationDays: 14,
  wantedId: null,
};

describe("PaymentWalkthrough", () => {
  it("says it is a simulation and makes no network request", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    render(<PaymentWalkthrough seed={seed} />);
    expect(screen.getByRole("note")).toHaveTextContent(/No money moves and nothing is saved/);
    fireEvent.click(screen.getByRole("button", { name: /Pay RM/ }));
    for (let i = 0; i < 6; i += 1) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });

  it("waits for a checkout choice before moving on", () => {
    render(<PaymentWalkthrough seed={seed} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("never treats the return page as confirmation", () => {
    render(<PaymentWalkthrough seed={seed} />);
    fireEvent.click(screen.getByRole("button", { name: /Pay RM/ }));
    expect(screen.getByRole("heading", { name: /Back from payment/ })).toBeInTheDocument();
    expect(screen.getByText(/A redirect is not proof of payment/)).toBeInTheDocument();
  });

  it("stops a failed payment with nothing charged", () => {
    render(<PaymentWalkthrough seed={seed} />);
    fireEvent.click(screen.getByRole("button", { name: "Payment fails" }));
    expect(screen.getByText(/No charge was made and no Wanted was opened/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("splits the payout in integer sen with the fee rounded down", () => {
    render(<PaymentWalkthrough seed={{ ...seed, amountSen: sen(1555) }} />);
    fireEvent.click(screen.getByRole("button", { name: /Pay RM/ }));
    for (let i = 0; i < 5; i += 1) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const breakdown = screen.getByLabelText("Payout calculation");
    // RM15.55 + RM10.00 = RM25.55; 10% = 255.5 sen, rounded down to 255.
    expect(breakdown).toHaveTextContent(/25\.55/);
    expect(breakdown).toHaveTextContent(/2\.55/);
    expect(breakdown).toHaveTextContent(/Paid to the Hunter\s*RM\s?23$/);
  });
});
