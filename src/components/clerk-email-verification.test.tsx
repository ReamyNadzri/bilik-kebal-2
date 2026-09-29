import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ClerkEmailVerification } from "./clerk-email-verification";
import { clerkHooks } from "@/features/presentation/test-support/clerk-hooks";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function signedInWith(status: "unverified" | "verified") {
  const address = {
    emailAddress: "aina@student.uitm.edu.my",
    verification: { status },
    prepareVerification: vi.fn(async () => address),
    attemptVerification: vi.fn(async () => ({ verification: { status: "verified" } })),
  };
  clerkHooks.user = { primaryEmailAddress: address };
  return address;
}

beforeEach(() => {
  refresh.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ json: async () => ({ ok: true, data: { synced: true } }) })),
  );
});

afterEach(() => vi.unstubAllGlobals());

test("asks a signed-out visitor to sign in first", () => {
  render(<ClerkEmailVerification />);

  expect(screen.getByText("Sign in to verify your email")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in?next=/verify-email",
  );
});

test("sends a code, verifies it, and updates VAULTIX straight away", async () => {
  const address = signedInWith("unverified");
  render(<ClerkEmailVerification />);

  fireEvent.click(screen.getByRole("button", { name: "Send the code" }));
  expect(await screen.findByText("Check your email")).toBeInTheDocument();
  expect(address.prepareVerification).toHaveBeenCalledWith({ strategy: "email_code" });

  fireEvent.change(screen.getByLabelText(/Code from the email/), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify email" }));

  expect(await screen.findByText("Your email is verified")).toBeInTheDocument();
  expect(address.attemptVerification).toHaveBeenCalledWith({ code: "123456" });
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith("/api/identity/clerk-sync", { method: "POST" }),
  );
  await waitFor(() => expect(refresh).toHaveBeenCalled());
});

test("keeps the code step open for a wrong code", async () => {
  const address = signedInWith("unverified");
  address.attemptVerification.mockRejectedValue({ errors: [{ code: "form_code_incorrect" }] });
  render(<ClerkEmailVerification />);

  fireEvent.click(screen.getByRole("button", { name: "Send the code" }));
  await screen.findByLabelText(/Code from the email/);
  fireEvent.change(screen.getByLabelText(/Code from the email/), { target: { value: "000000" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify email" }));

  expect(await screen.findByText(/That code is not correct/)).toBeInTheDocument();
  expect(screen.queryByText("Your email is verified")).not.toBeInTheDocument();
});

test("an address Clerk already verified is synced to VAULTIX once", async () => {
  signedInWith("verified");
  render(<ClerkEmailVerification />);

  expect(screen.getByText("Your email is verified")).toBeInTheDocument();
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(fetch).toHaveBeenCalledOnce();
});
