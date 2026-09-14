import { render, screen } from "@testing-library/react";
import PostWantedPage from "./page";

test("explains the requirement rather than opening a form that cannot submit", () => {
  render(<PostWantedPage />);

  expect(screen.getByRole("heading", { level: 1, name: "Post a Wanted" })).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("says institution verification is what unlocks publishing", () => {
  render(<PostWantedPage />);

  expect(screen.getByText(/Email verification alone is not enough/i)).toBeInTheDocument();
});

test("routes to the verification screen the product already has", () => {
  render(<PostWantedPage />);

  expect(screen.getByRole("link", { name: "Verify your institution" })).toHaveAttribute(
    "href",
    "/profile/institution-verification",
  );
});

test("offers sign-in without making it the point of the page", () => {
  render(<PostWantedPage />);

  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent(/sign in/i);
});

test("sends the reader to check for a duplicate request first", () => {
  render(<PostWantedPage />);

  expect(screen.getByRole("link", { name: "Browse the Wanted Board" })).toHaveAttribute(
    "href",
    "/board",
  );
});

test("states the content policy and that a Sheriff decides", () => {
  render(<PostWantedPage />);

  expect(screen.getByText(/a Sheriff reviews every claim/i)).toBeInTheDocument();
});
