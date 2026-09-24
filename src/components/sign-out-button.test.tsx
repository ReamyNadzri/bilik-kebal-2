import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignOutButton } from "./sign-out-button";
import { AuthProvider } from "@/features/presentation/auth/auth-provider";
import { anAccountViewModel } from "@/features/presentation/test-support/account-view-model";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => "/sign-out",
}));

function respondWith(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ json: async () => body } as unknown as Response),
  );
}

function renderButton() {
  return render(
    <AuthProvider initialAccount={anAccountViewModel()}>
      <SignOutButton />
    </AuthProvider>,
  );
}

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  vi.unstubAllGlobals();
});

test("signs out through the auth provider and leaves the signed-in screen", async () => {
  respondWith({ ok: true, data: { signedOut: true } });
  renderButton();

  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

  await waitFor(() => expect(replace).toHaveBeenCalled());
  expect(refresh).toHaveBeenCalled();
});

test("stays put and says so when the sign-out is refused", async () => {
  respondWith({ ok: false, code: "AUTH_UNAVAILABLE", message: "" });
  renderButton();

  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/could not be signed out/i);
  expect(replace).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
});
