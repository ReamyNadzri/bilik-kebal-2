import { render, screen } from "@testing-library/react";
import { BountyPlate } from "./bounty-plate";
import { toSen } from "@/features/marketplace/money";

test("reads as one money value to assistive technology", () => {
  render(<BountyPlate amountSen={toSen(85)} />);

  expect(screen.getByText("Total bounty RM 85.00")).toBeInTheDocument();
});

test("splits the unit from the amount for the stacked plate", () => {
  const { container } = render(<BountyPlate amountSen={toSen(85)} />);

  expect(container.querySelector(".bounty-plate__unit")).toHaveTextContent("RM");
  expect(container.querySelector(".bounty-plate__value")).toHaveTextContent("85");
});

test("hides the split halves from assistive technology so the value is not read twice", () => {
  const { container } = render(<BountyPlate amountSen={toSen(85)} />);

  expect(container.querySelector(".bounty-plate__unit")).toHaveAttribute("aria-hidden", "true");
  expect(container.querySelector(".bounty-plate__value")).toHaveAttribute("aria-hidden", "true");
});

test("uses tabular figures so plates align down a column", () => {
  const { container } = render(<BountyPlate amountSen={toSen(85)} />);

  expect(container.querySelector(".bounty-plate__value")).toHaveClass("numeric");
});

test("shows a part-Ringgit amount with its sen", () => {
  render(<BountyPlate amountSen={toSen(7.5)} />);

  expect(screen.getByText("Total bounty RM 7.50")).toBeInTheDocument();
});

test("takes a caller's wording when the plate is not a total", () => {
  render(<BountyPlate amountSen={toSen(10)} label="Your contribution" />);

  expect(screen.getByText("Your contribution RM 10.00")).toBeInTheDocument();
});
