import { fireEvent, render, screen, within } from "@testing-library/react";
import ExploreMapPage from "./page";

test("says the campus figures are development fixtures", () => {
  render(<ExploreMapPage />);

  expect(screen.getByText("Development only")).toBeInTheDocument();
  expect(screen.getByText(/The Explore Map shows development fixture data/)).toBeInTheDocument();
  expect(screen.getByText(/not live totals/i)).toBeInTheDocument();
});

test("leads with the question from the handoff and a described map", () => {
  render(<ExploreMapPage />);

  expect(
    screen.getByRole("heading", { level: 1, name: "Where is knowledge needed?" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /illustrated map of malaysia/i })).toBeInTheDocument();
});

test("offers every campus both as a map pin and in the list", () => {
  render(<ExploreMapPage />);

  const list = screen.getByRole("list", { name: "Campuses" });

  expect(within(list).getAllByRole("button")).toHaveLength(13);
  expect(screen.getAllByRole("button", { name: /^Map pin:/ })).toHaveLength(13);
});

test("opens on Shah Alam and formats its bounty from integer sen", () => {
  render(<ExploreMapPage />);

  expect(screen.getByRole("heading", { level: 2, name: "UiTM Shah Alam" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^UiTM Shah Alam/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: /^UiTM Shah Alam/ })).toHaveTextContent("RM 780");
});

test("selecting a pin updates the campus panel and the list together", () => {
  render(<ExploreMapPage />);

  fireEvent.click(screen.getByRole("button", { name: /^Map pin: UiTM Kota Kinabalu/ }));

  expect(
    screen.getByRole("heading", { level: 2, name: "UiTM Kota Kinabalu" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^UiTM Kota Kinabalu/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: /^UiTM Shah Alam/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("links to the Board as it is rather than a campus filter it cannot honour", () => {
  render(<ExploreMapPage />);

  expect(screen.getByRole("link", { name: /View the Wanted Board/ })).toHaveAttribute(
    "href",
    "/board",
  );
});
