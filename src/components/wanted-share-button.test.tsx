import { fireEvent, render, screen } from "@testing-library/react";
import { aWanted } from "@/features/marketplace/test-support/wanted";
import { WantedShareButton } from "./wanted-share-button";

test("is an icon named Share that says it opens a dialog", () => {
  render(<WantedShareButton wanted={aWanted()} />);

  const share = screen.getByRole("button", { name: "Share" });
  expect(share).toHaveAttribute("aria-haspopup", "dialog");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("opens the share poster, and gives focus back when it closes", () => {
  render(<WantedShareButton wanted={aWanted({ title: "Final exam notes" })} />);
  const share = screen.getByRole("button", { name: "Share" });

  fireEvent.click(share);
  expect(screen.getByRole("dialog", { name: /Share this Wanted/ })).toBeInTheDocument();

  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(share).toHaveFocus();
});

test("takes a name that says which request it shares", () => {
  render(<WantedShareButton wanted={aWanted()} label="Share this Wanted: Final exam notes" />);

  expect(
    screen.getByRole("button", { name: "Share this Wanted: Final exam notes" }),
  ).toBeInTheDocument();
});
