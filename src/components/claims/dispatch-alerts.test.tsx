import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DispatchAlertBanner } from "./dispatch-alert-banner";
import { DispatchAlertToast } from "./dispatch-alert-toast";

describe("DispatchAlertBanner", () => {
  it("renders quarantine screening status alert", () => {
    render(<DispatchAlertBanner status="screening" />);
    expect(screen.getByTestId("dispatch-alert-screening")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /dispatched to quarantine screening/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/automated integrity, checksum/i)).toBeInTheDocument();
  });

  it("renders sheriff review queue alert for under_review", () => {
    render(<DispatchAlertBanner status="under_review" />);
    expect(screen.getByTestId("dispatch-alert-under_review")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /dispatched to sheriff review queue/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/authorized institution sheriff/i)).toBeInTheDocument();
  });

  it("renders approved winning alert", () => {
    render(<DispatchAlertBanner status="approved" />);
    expect(screen.getByTestId("dispatch-alert-approved")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /bounty claim approved/i })).toBeInTheDocument();
  });

  it("renders not_selected distinctly from rejected", () => {
    render(<DispatchAlertBanner status="not_selected" />);
    expect(screen.getByTestId("dispatch-alert-not_selected")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /not selected/i })).toBeInTheDocument();
    expect(screen.getByText(/another hunter's submission was selected/i)).toBeInTheDocument();
  });

  it("renders rejected alert with reviewer note if provided", () => {
    render(
      <DispatchAlertBanner
        status="rejected"
        reviewerNote="Document lacks required 2026 course syllabus matching."
      />,
    );
    expect(screen.getByTestId("dispatch-alert-rejected")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /claim submission rejected/i })).toBeInTheDocument();
    expect(
      screen.getByText("Document lacks required 2026 course syllabus matching."),
    ).toBeInTheDocument();
  });

  it("renders needs_information alert with custom note", () => {
    render(
      <DispatchAlertBanner
        status="needs_information"
        reviewerNote="Please attach the cover page with instructor signature."
      />,
    );
    expect(screen.getByTestId("dispatch-alert-needs_information")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /needs clarification/i })).toBeInTheDocument();
    expect(
      screen.getByText("Please attach the cover page with instructor signature."),
    ).toBeInTheDocument();
  });

  it("includes accessible role=status and aria-live=polite", () => {
    render(<DispatchAlertBanner status="screening" />);
    const alert = screen.getByRole("status");
    expect(alert).toHaveAttribute("aria-live", "polite");
  });
});

describe("DispatchAlertToast", () => {
  it("renders toast with title, message, and badge label", () => {
    const onDismiss = vi.fn();
    render(
      <DispatchAlertToast
        title="Proof Dispatched"
        message="Your proof was uploaded to quarantine."
        tier="info"
        onDismiss={onDismiss}
        autoDismissMs={0}
      />,
    );

    expect(screen.getByTestId("dispatch-alert-toast")).toBeInTheDocument();
    expect(screen.getByText("Proof Dispatched")).toBeInTheDocument();
    expect(screen.getByText("Your proof was uploaded to quarantine.")).toBeInTheDocument();
    expect(screen.getByText("DISPATCH EVENT")).toBeInTheDocument();
  });

  it("calls onDismiss when close button is clicked", () => {
    const onDismiss = vi.fn();
    render(
      <DispatchAlertToast
        title="Proof Dispatched"
        message="Details"
        onDismiss={onDismiss}
        autoDismissMs={0}
      />,
    );

    const closeBtn = screen.getByRole("button", { name: /dismiss alert/i });
    fireEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when Escape key is pressed", () => {
    const onDismiss = vi.fn();
    render(
      <DispatchAlertToast
        title="Proof Dispatched"
        message="Details"
        onDismiss={onDismiss}
        autoDismissMs={0}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
