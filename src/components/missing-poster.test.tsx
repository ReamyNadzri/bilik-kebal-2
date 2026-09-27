import { render, screen } from "@testing-library/react";
import { MissingPoster } from "./missing-poster";
import { aHunter } from "@/features/presentation/test-support/hunters";

describe("MissingPoster", () => {
  test("is one link to the member's profile, named for the member", () => {
    const hunter = aHunter(1, { displayName: "Aina Sofea" });
    render(<MissingPoster hunter={hunter} />);

    const link = screen.getByRole("link", { name: "View profile of Aina Sofea" });
    expect(link).toHaveAttribute("href", `/u/${hunter.publicId}?from=hunters`);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  test("shows the name, verified institution and joined month", () => {
    render(<MissingPoster hunter={aHunter(2, { institutionName: "UiTM Arau" })} />);

    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.getByText("Hunter 2")).toBeInTheDocument();
    expect(screen.getByText("UiTM Arau")).toBeInTheDocument();
    expect(screen.getByText("Mar 2024").closest("time")).toHaveAttribute(
      "dateTime",
      "2024-03-10T04:00:00.000Z",
    );
  });

  test("uses the member's own picture, and the drawn default when they have none", () => {
    const { container, rerender } = render(<MissingPoster hunter={aHunter(1)} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/brand/avatar-3.webp");

    rerender(<MissingPoster hunter={aHunter(2)} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/brand/avatar-1.webp");
  });

  test("never carries an email address", () => {
    render(<MissingPoster hunter={aHunter(3)} />);

    expect(document.body.textContent).not.toMatch(/@/);
  });

  test("the profile's big copy is not a link and is hidden from assistive technology", () => {
    const { container } = render(<MissingPoster hunter={aHunter(4)} variant="big" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  test("is pinned or taped, the same way every time", () => {
    const first = render(<MissingPoster hunter={aHunter(5)} />);
    const fixing = first.container.firstElementChild?.className;
    first.unmount();

    const again = render(<MissingPoster hunter={aHunter(5)} />);
    expect(again.container.firstElementChild?.className).toBe(fixing);
    expect(fixing).toMatch(/missing-poster--(pin|tape)/);
  });
});
