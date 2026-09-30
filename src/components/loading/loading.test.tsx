import { render, screen } from "@testing-library/react";
import ArchiveLoading from "@/app/archive/loading";
import { LoadingIndicator } from "./loading-indicator";

test("the indicator is one polite status with words, the drawing hidden", () => {
  const { container } = render(<LoadingIndicator label="Loading the Archive" />);

  expect(screen.getByRole("status")).toHaveTextContent("Loading the Archive…");
  expect(container.querySelector(".loading-indicator__revolver")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

test("a page skeleton keeps its heading, hides the placeholders and takes no focus", () => {
  const { container } = render(<ArchiveLoading />);

  expect(screen.getByRole("heading", { level: 1, name: "Archive" })).toBeInTheDocument();
  expect(container.querySelector(".page-skeleton__body")).toHaveAttribute("aria-hidden", "true");
  expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(document.activeElement).toBe(document.body);
});
