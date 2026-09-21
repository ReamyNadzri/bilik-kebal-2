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
