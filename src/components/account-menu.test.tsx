import { act, render, screen, waitFor } from "@testing-library/react";
import { AccountMenu } from "./account-menu";
import type { AccountViewModel } from "@/contracts";
import { AuthProvider } from "@/features/presentation/auth/auth-provider";
import { anAccountViewModel } from "@/features/presentation/test-support/account-view-model";

const replace = vi.fn();
const refresh = vi.fn();
const pathname = vi.hoisted(() => ({ current: "/board" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => pathname.current,
}));

function respondWith(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ json: async () => body } as unknown as Response),
  );
}

function renderMenu(account: AccountViewModel | null) {
  return render(
    <AuthProvider initialAccount={account}>
      <AccountMenu />
    </AuthProvider>,
  );
}

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  pathname.current = "/board";
  vi.unstubAllGlobals();
});

describe("signed out", () => {
  test("offers a sign-in route that returns the viewer here", () => {
    pathname.current = "/wanted/csc510-final-exam-notes";
    renderMenu(null);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fwanted%2Fcsc510-final-exam-notes",
    );
  });

  /** Offering to return someone to the sign-in screen is a loop, not a courtesy. */
  test("does not carry a guest screen forward", () => {
    pathname.current = "/sign-up";
    renderMenu(null);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  });
});

describe("signed in", () => {
  test("shows the picture, name, star and trust state, and links to the profile", () => {
    renderMenu(
      anAccountViewModel({
        displayName: "Aina",
        publicId: "11111111-1111-4111-8111-111111111111",
        trust: { email: "verified", institution: "verified", restricted: false },
      }),
    );

    expect(screen.getByText("Institution verified")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View my profile" })).toHaveAttribute(
      "href",
      "/u/11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByRole("link", { name: "Edit profile" })).toHaveAttribute("href", "/profile");
  });

  test("opens and closes the menu from the keyboard", () => {
    renderMenu(anAccountViewModel({ displayName: "Aina" }));
    const trigger = screen.getByRole("button", { name: /Aina/ });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    act(() => trigger.click());
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    act(() => {
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("names the account and offers the way out", () => {
    renderMenu(anAccountViewModel({ displayName: "Aina" }));

    expect(screen.getByText("Aina")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  /**
   * A button, not a link: sign-out changes server state, and a link invites a
   * prefetch that would end the session without the viewer asking.
   */
  test("offers sign-out as a button rather than a link", () => {
    renderMenu(anAccountViewModel());

    expect(screen.queryByRole("link", { name: "Sign out" })).not.toBeInTheDocument();
  });

  test("labels the name for a screen reader", () => {
    renderMenu(anAccountViewModel({ displayName: "Aina" }));

    expect(screen.getByText("Signed in as")).toBeInTheDocument();
  });

  test("signs the viewer out and returns them to the homepage", async () => {
    respondWith({ ok: true, data: { signedOut: true } });

    renderMenu(anAccountViewModel());
    act(() => screen.getByRole("button", { name: "Sign out" }).click());

    await waitFor(() => expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument());
    expect(replace).toHaveBeenCalledWith("/");
  });

  test("announces a failed sign-out and keeps the account on screen", async () => {
    respondWith({
      ok: false,
      code: "AUTH_UNAVAILABLE",
      message: "Identity services are temporarily unavailable. Try again.",
    });

    renderMenu(anAccountViewModel({ displayName: "Aina" }));
    act(() => screen.getByRole("button", { name: "Sign out" }).click());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Identity services are temporarily unavailable. Try again.",
      ),
    );
    expect(screen.getByText("Aina")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
