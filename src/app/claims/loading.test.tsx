import { render, screen } from "@testing-library/react";
import ClaimsLoading from "./loading";

test("announces the wait without taking focus from the reader", () => {
  render(<ClaimsLoading />);

  expect(screen.getByRole("status")).toHaveTextContent("Loading hunts and claims");
  expect(document.activeElement).toBe(document.body);
});

test("keeps the page heading in place while it loads", () => {
  render(<ClaimsLoading />);

  expect(screen.getByRole("heading", { level: 1, name: "Hunt" })).toBeInTheDocument();
});
