import { fireEvent, render, screen } from "@testing-library/react";
import { BoardViewToggle } from "./board-view-toggle";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockReset());

test("says which view is showing", () => {
  render(<BoardViewToggle current="hunters" />);

  expect(screen.getByRole("group", { name: "Board view" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Hunters" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Wanted requests" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("opens the other view by its URL, and does nothing for the current one", () => {
  render(<BoardViewToggle current="wanted" />);

  fireEvent.click(screen.getByRole("button", { name: "Wanted requests" }));
  expect(push).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Hunters" }));
  expect(push).toHaveBeenCalledWith("/board?view=hunters");
});
