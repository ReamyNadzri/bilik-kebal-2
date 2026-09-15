import { render, screen } from "@testing-library/react";
import { StatusStamp } from "./status-stamp";
import { claimStatusPresentation, wantedStatusPresentation } from "@/features/marketplace/status";

test("always renders the status word", () => {
  render(<StatusStamp presentation={wantedStatusPresentation("ending-soon")} />);

  expect(screen.getByText("Ending soon")).toBeInTheDocument();
});

test("carries the tone and the emphasis as separate classes", () => {
  const { container } = render(<StatusStamp presentation={wantedStatusPresentation("open")} />);
  const stamp = container.querySelector(".status-stamp");

  expect(stamp).toHaveClass("status-stamp--success");
  expect(stamp).toHaveClass("status-stamp--solid");
});

test("names what the status describes, so a stamp is not an unattached word", () => {
  render(<StatusStamp presentation={wantedStatusPresentation("reviewing")} context="Wanted" />);

  expect(screen.getByText("Wanted status:")).toBeInTheDocument();
});

test("keeps Not selected and Rejected visually distinct", () => {
  const { container: notSelected } = render(
    <StatusStamp presentation={claimStatusPresentation("not-selected")} />,
  );
  const { container: rejected } = render(
    <StatusStamp presentation={claimStatusPresentation("rejected")} />,
  );

  expect(notSelected.querySelector(".status-stamp")?.className).not.toBe(
    rejected.querySelector(".status-stamp")?.className,
  );
});

test("does not decorate the stamp with anything a screen reader would read", () => {
  render(<StatusStamp presentation={claimStatusPresentation("approved")} />);

  expect(screen.getByText("Approved").textContent).toBe("Approved");
});
