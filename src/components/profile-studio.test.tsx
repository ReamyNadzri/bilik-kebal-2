import { fireEvent, render, screen, within } from "@testing-library/react";
import { ProfileStudio } from "./profile-studio";

test("shows every supplied avatar as a clearly fixture-backed choice", () => {
  render(<ProfileStudio />);

  expect(screen.getByRole("heading", { name: "Your hunter licence" })).toBeInTheDocument();
  expect(screen.getByRole("radiogroup", { name: "Choose an avatar" })).toBeInTheDocument();
  expect(
    within(screen.getByRole("radiogroup", { name: "Choose an avatar" })).getAllByRole("radio"),
  ).toHaveLength(12);
  expect(screen.getByText(/Changes stay in this browser preview/i)).toBeInTheDocument();
});

test("updates the fixture licence when an avatar or tone is chosen", () => {
  render(<ProfileStudio />);

  const avatar = screen.getByRole("radio", { name: "Black hijab specs" });
  fireEvent.click(avatar);
  fireEvent.click(screen.getByRole("radio", { name: "Deep" }));

  expect(avatar).toBeChecked();
  expect(screen.getByRole("radio", { name: "Deep" })).toBeChecked();
  expect(screen.getByAltText("Fixture avatar: Black hijab specs")).toHaveClass("avatar--tone-deep");
});
