import { render, screen } from "@testing-library/react";
import { FixtureNotice } from "./fixture-notice";

test("states plainly that the data is not real", () => {
  render(<FixtureNotice />);

  const notice = screen.getByRole("note");

  expect(notice).toHaveTextContent(/development fixture data/i);
  expect(notice).toHaveTextContent(/not connected/i);
});

test("names the screen when one is given", () => {
  render(<FixtureNotice screen="Institution verification" />);

  expect(screen.getByRole("note")).toHaveTextContent("Institution verification");
});

test("conveys its warning in text, not by colour alone", () => {
  render(<FixtureNotice />);

  expect(screen.getByText("Development only")).toBeInTheDocument();
});
