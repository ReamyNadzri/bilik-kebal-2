import { render, screen } from "@testing-library/react";
import PostWantedPage from "./page";
import type { AccountViewModel } from "@/contracts";
import { anAccountViewModel } from "@/features/presentation/test-support/account-view-model";

const loadAccountViewModel = vi.hoisted(() => vi.fn());

vi.mock("@/modules/identity", () => ({
  loadAccountViewModel,
}));

beforeEach(() => {
  loadAccountViewModel.mockReset();
});

function eligible(overrides: Partial<AccountViewModel> = {}): AccountViewModel {
  return anAccountViewModel({
    trust: { email: "verified", institution: "verified", restricted: false },
    capabilities: { browseMetadata: true, transact: true, submitClaim: true, download: true },
    ...overrides,
  });
}

async function renderPage(params: Record<string, string> = {}) {
  return render(await PostWantedPage({ searchParams: Promise.resolve(params) }));
}

test("names the screen whatever the viewer may do", async () => {
  loadAccountViewModel.mockResolvedValue(null);
  await renderPage();

  expect(screen.getByRole("heading", { level: 1, name: "Post a Wanted" })).toBeInTheDocument();
});

describe("who may not create a request", () => {
  test("asks an unattributed visitor to sign in", async () => {
    loadAccountViewModel.mockResolvedValue(null);
    await renderPage();

    expect(screen.getByRole("heading", { name: "Sign in to post a Wanted" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.queryByLabelText(/^Title/)).not.toBeInTheDocument();
  });

  test("says identity is unavailable rather than blaming the account", async () => {
    loadAccountViewModel.mockRejectedValue(new Error("supabase down"));
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Your account could not be loaded" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/not a problem with your account/i)).toBeInTheDocument();
  });

  test("sends an unverified email address to verification first", async () => {
    loadAccountViewModel.mockResolvedValue(
      eligible({
        trust: { email: "unverified", institution: "unverified", restricted: false },
        capabilities: {
          browseMetadata: false,
          transact: false,
          submitClaim: false,
          download: false,
        },
      }),
    );
    await renderPage();

    expect(screen.getByRole("heading", { name: "Verify your email first" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /verification/i })).toHaveAttribute(
      "href",
      "/verify-email",
    );
  });

  test("tells a restricted account that a Sheriff decides, not this screen", async () => {
    loadAccountViewModel.mockResolvedValue(
      eligible({
        trust: { email: "verified", institution: "verified", restricted: true },
        capabilities: {
          browseMetadata: true,
          transact: false,
          submitClaim: false,
          download: false,
        },
      }),
    );
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "This account cannot post a Wanted" }),
    ).toBeInTheDocument();
    // "Restricted" is also the status label on the panel, so the sentence is
    // matched rather than the bare word.
    expect(
      screen.getByText(/This account is restricted, so it cannot publish or fund a request/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/A Sheriff decides when a restriction is lifted/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Title/)).not.toBeInTheDocument();
  });

  test("routes an institution-unverified account to verification", async () => {
    loadAccountViewModel.mockResolvedValue(
      eligible({
        trust: { email: "verified", institution: "unverified", restricted: false },
        capabilities: {
          browseMetadata: true,
          transact: false,
          submitClaim: false,
          download: false,
        },
      }),
    );
    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Verify your institution to post a Wanted" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Verify your institution" })).toHaveAttribute(
      "href",
      "/profile/institution-verification",
    );
  });

  test("says a pending verification is waiting rather than repeating the ask", async () => {
    loadAccountViewModel.mockResolvedValue(
      eligible({
        trust: { email: "verified", institution: "pending", restricted: false },
        capabilities: {
          browseMetadata: true,
          transact: false,
          submitClaim: false,
          download: false,
        },
      }),
    );
    await renderPage();

    expect(screen.getByText(/A Sheriff is reviewing your verification/i)).toBeInTheDocument();
  });

  /**
   * Eligibility is the backend's `transact` capability, never a trust state
   * recomputed here. A viewer who looks verified but whom the backend refuses
   * must still be refused.
   */
  test("refuses a viewer the backend has not granted transacting, however verified they look", async () => {
    loadAccountViewModel.mockResolvedValue(
      eligible({
        capabilities: {
          browseMetadata: true,
          transact: false,
          submitClaim: true,
          download: true,
        },
      }),
    );
    await renderPage();

    expect(screen.queryByLabelText(/^Title/)).not.toBeInTheDocument();
  });
});

describe("an eligible Commissioner", () => {
  beforeEach(() => {
    loadAccountViewModel.mockResolvedValue(eligible());
  });

  test("gets the creation form", async () => {
    await renderPage();

    expect(screen.getByLabelText(/^Title/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review request" })).toBeInTheDocument();
  });

  test("sees the screen marked as fixture-backed", async () => {
    await renderPage();

    expect(screen.getByText("Development only")).toBeInTheDocument();
  });

  test("is never shown a refusal alongside the form", async () => {
    await renderPage();

    expect(screen.queryByRole("heading", { name: /Verify your/ })).not.toBeInTheDocument();
  });

  test("is told the taxonomy could not be read rather than offered no campus", async () => {
    await renderPage({ preview: "unavailable" });

    expect(
      screen.getByRole("heading", { name: "The course list could not be loaded" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Title/)).not.toBeInTheDocument();
  });

  test("is told when the taxonomy has been published but is empty", async () => {
    await renderPage({ preview: "empty" });

    expect(
      screen.getByRole("heading", { name: "No courses have been published yet" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Title/)).not.toBeInTheDocument();
  });
});

test("never claims a request, draft or payment exists", async () => {
  loadAccountViewModel.mockResolvedValue(eligible());
  const { container } = await renderPage();

  expect(container.textContent).not.toMatch(/successfully|payment (received|complete)/i);
  expect(container.querySelector('input[type="file"]')).toBeNull();
});
