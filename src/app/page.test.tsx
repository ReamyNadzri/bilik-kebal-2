import { render, screen } from "@testing-library/react";
import HomePage from "./page";

test("identifies the VAULTIX application", () => {
  render(<HomePage />);

  expect(screen.getByRole("heading", { name: "VAULTIX" })).toBeInTheDocument();
});
