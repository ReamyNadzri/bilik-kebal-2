import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import BoardLoading from "./loading";

test("shows poster placeholders and one polite loading status", () => {
  const { container } = render(<BoardLoading />);

  expect(screen.getByRole("heading", { level: 1, name: "Wanted Board" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Loading the Wanted Board");
  expect(container.querySelectorAll(".skeleton-poster")).toHaveLength(6);
  expect(container.querySelector(".board__results")).toHaveAttribute("aria-hidden", "true");
});
