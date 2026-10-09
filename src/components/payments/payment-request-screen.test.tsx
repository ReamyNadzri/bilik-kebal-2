import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  paymentPreviewFixture,
  type PaymentPreviewState,
} from "@/features/presentation/payments/payment-request-fixtures";
import { PaymentRequestScreen } from "./payment-request-screen";

function renderState(state: PaymentPreviewState) {
  const fixture = paymentPreviewFixture(state);
  return render(
    <PaymentRequestScreen
      request={fixture.request}
      methods={fixture.methods}
      connection={fixture.connection}
      restricted={fixture.restricted}
      retryHref="/payment/requests/preview"
      mode="preview"
    />,
  );
}

const payInstructions = () => screen.queryByRole("heading", { name: /Choose how to pay/ });
const proofForm = () => screen.queryByRole("form");

describe("PaymentRequestScreen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the total to type, made up of the contribution and the fee on top", () => {
    renderState("ready");

    expect(screen.getByText("Type exactly")).toBeInTheDocument();
    const breakdown = screen.getByLabelText("How the amount is made up");
    expect(within(breakdown).getByText("RM 10.00")).toBeInTheDocument();
    expect(within(breakdown).getByText("+RM 1.00")).toBeInTheDocument();
    expect(within(breakdown).getByText("RM 11.00")).toBeInTheDocument();
    expect(screen.getByText(/do not fill in the amount/)).toBeInTheDocument();
  });

  it("offers the configured QR and link, with the recipient to check", () => {
    renderState("ready");

    expect(payInstructions()).toBeInTheDocument();
    expect(screen.getByText(/Check this name in your app/)).toHaveTextContent("AF ECommerce");
    expect(screen.getByRole("img", { name: "DuitNow QR code for AF ECommerce" })).toHaveAttribute(
      "src",
      "/payments/duitnow-qr.png",
    );
    const link = screen.getByRole("link", { name: /Open payment link/ });
    expect(link).toHaveAttribute("href", "https://payment.tngdigital.com.my/sc/bDLn8K4vWL");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/does not confirm a payment/)).toBeInTheDocument();
  });

  it("copies the bare figure an app's amount field expects", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    renderState("ready");

    fireEvent.click(screen.getByRole("button", { name: "Copy amount" }));

    expect(writeText).toHaveBeenCalledWith("11.00");
    expect(await screen.findByText("Copied 11.00.")).toBeInTheDocument();
  });

  it("says when copying is blocked, and the amount stays on screen", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    renderState("ready");

    fireEvent.click(screen.getByRole("button", { name: "Copy amount" }));

    expect(await screen.findByText(/Copying is blocked here/)).toBeInTheDocument();
  });

  it("shows absent methods as absent and offers nothing to pay with", () => {
    renderState("unconfigured");

    expect(screen.getByText("Payment is not available yet")).toBeInTheDocument();
    expect(screen.getByText("Merchant QR not supplied")).toBeInTheDocument();
    expect(screen.getByText("Payment link not configured")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open payment link/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /DuitNow QR code/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy amount" })).not.toBeInTheDocument();
  });

  it("shows no amount and no code while the request loads", () => {
    renderState("loading");

    expect(screen.getByText("Loading your payment request")).toBeInTheDocument();
    expect(screen.queryByText(/RM /)).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("tells a member whose proof is being checked not to pay again", () => {
    renderState("checking");

    expect(screen.getByText("Waiting for payment verification")).toBeInTheDocument();
    expect(screen.getByText("Do not pay again.")).toBeInTheDocument();
    expect(payInstructions()).not.toBeInTheDocument();
    expect(proofForm()).not.toBeInTheDocument();
    expect(screen.queryByText("Type exactly")).not.toBeInTheDocument();
    expect(screen.getByText("Amount requested")).toBeInTheDocument();
    expect(screen.getByText(/Version 1, sent/)).toBeInTheDocument();
  });

  it("gives the reason and next step, and takes a new screenshot on the same request", () => {
    renderState("needs-information");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The payment reference is not readable.");
    expect(alert).toHaveTextContent("You do not need to pay again.");
    expect(payInstructions()).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Send a clearer screenshot" })).toBeInTheDocument();
  });

  it("keeps every earlier screenshot after a rejection", () => {
    renderState("rejected");

    expect(screen.getByRole("alert")).toHaveTextContent("Payment not confirmed");
    expect(
      screen.getByRole("heading", { name: "Send the correct screenshot" }),
    ).toBeInTheDocument();
    const history = screen.getByRole("list");
    expect(within(history).getAllByRole("listitem")).toHaveLength(2);
    expect(within(history).getByText("Not accepted")).toBeInTheDocument();
    expect(within(history).getByText("More needed")).toBeInTheDocument();
  });

  it("holds unresolved funds without asking for another payment or promising a refund", () => {
    renderState("exception");

    expect(screen.getByText("Your payment needs resolving")).toBeInTheDocument();
    expect(screen.getByText("You do not need to pay again.")).toBeInTheDocument();
    expect(screen.queryByText(/refund/i)).not.toBeInTheDocument();
    expect(payInstructions()).not.toBeInTheDocument();
    expect(proofForm()).not.toBeInTheDocument();
  });

  it("confirms a first payment as published, with one receipt", () => {
    renderState("confirmed-publish");

    expect(
      screen.getByRole("heading", { name: "Payment confirmed. Your Wanted is published." }),
    ).toBeInTheDocument();
    const receipt = screen.getByLabelText("Receipt");
    expect(within(receipt).getByText("RM 11.00")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /^Receipt / })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Open the Wanted" })).toHaveAttribute(
      "href",
      "/wanted/00000000-0000-4000-8000-000000000009",
    );
    expect(payInstructions()).not.toBeInTheDocument();
    expect(proofForm()).not.toBeInTheDocument();
  });

  it("confirms a Backer's contribution against the existing Wanted", () => {
    renderState("confirmed-back");

    expect(screen.getByRole("heading", { name: "Contribution confirmed." })).toBeInTheDocument();
    expect(screen.getByText(/RM 20 was added to the bounty/)).toBeInTheDocument();
    expect(screen.queryByText(/published/)).not.toBeInTheDocument();
  });

  it("stops new payment on a closed request but still takes proof of money already sent", () => {
    renderState("closed");

    expect(screen.getByText("This request no longer takes new payments")).toBeInTheDocument();
    expect(payInstructions()).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Already paid? Send your proof" }),
    ).toBeInTheDocument();
  });

  it("withholds new payment from a restricted account but keeps its proof route", () => {
    renderState("restricted");

    expect(screen.getByRole("alert")).toHaveTextContent("New payments are paused on your account");
    expect(payInstructions()).not.toBeInTheDocument();
    expect(proofForm()).toBeInTheDocument();
  });

  it("keeps the saved request on screen when offline and claims nothing", () => {
    renderState("offline");

    expect(screen.getByText("You are offline")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Check again" })).toHaveAttribute(
      "href",
      "/payment/requests/preview",
    );
    expect(screen.getByRole("button", { name: "Submit proof for checking" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
