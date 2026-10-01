import { fireEvent, render, screen } from "@testing-library/react";
import { CookieNotice } from "./cookie-notice";

beforeEach(() => window.localStorage.clear());

test("says which cookies VAULTIX uses until OK is pressed, and remembers it", () => {
  const { unmount } = render(<CookieNotice />);

  const notice = screen.getByRole("region", { name: "Cookies" });
  expect(notice).toHaveTextContent("only essential cookies");
  expect(notice).toHaveTextContent("No advertising or tracking cookies.");
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(screen.queryByRole("region", { name: "Cookies" })).toBeNull();

  unmount();
  render(<CookieNotice />);
  expect(screen.queryByRole("region", { name: "Cookies" })).toBeNull();
});
