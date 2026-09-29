const permanentRedirect = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
);

vi.mock("next/navigation", () => ({ permanentRedirect }));

import ResetPasswordPage from "./page";

test("sends links from older recovery emails to the Clerk recovery screen", () => {
  expect(() => ResetPasswordPage()).toThrow("NEXT_REDIRECT");
  expect(permanentRedirect).toHaveBeenCalledWith("/recover");
});
