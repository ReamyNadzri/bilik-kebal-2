import { render, screen } from "@testing-library/react";
import ClaimsLoading from "./loading";

test("announces the wait without taking focus from the reader", () => {
  render(<ClaimsLoading />);

  const status = screen
    .getByRole("heading", { name: "Loading hunts and claims" })
    .closest("section");

  expect(status).toHaveAttribute("aria-busy", "true");
  expect(status).toHaveAttribute("aria-live", "polite");
  expect(document.activeElement).toBe(document.body);
});

test("keeps the page heading in place while it loads", () => {
  render(<ClaimsLoading />);

  expect(screen.getByRole("heading", { level: 1, name: "Hunt" })).toBeInTheDocument();
});
