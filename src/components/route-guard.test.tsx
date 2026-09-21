import { render, screen } from "@testing-library/react";
import { RouteGuard } from "./route-guard";
import type { AccountViewModel } from "@/contracts";
import { AuthProvider } from "@/features/presentation/auth/auth-provider";
import { anAccountViewModel } from "@/features/presentation/test-support/account-view-model";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
  usePathname: () => "/wanted/csc510-final-exam-notes",
}));

function renderGuard(
  account: AccountViewModel | null,
  props: Partial<React.ComponentProps<typeof RouteGuard>> = {},
) {
  return render(
    <AuthProvider initialAccount={account}>
      <RouteGuard describe="the contribution form" {...props}>
        <p>Contribution form</p>
      </RouteGuard>
    </AuthProvider>,
  );
}

beforeEach(() => {
  replace.mockReset();
});

test("renders the guarded area for an account that may use it", () => {
  renderGuard(
    anAccountViewModel({
      capabilities: { browseMetadata: true, transact: true, submitClaim: true, download: true },
    }),
    { capability: "transact" },
  );

  expect(screen.getByText("Contribution form")).toBeInTheDocument();
});

describe("a signed-out viewer", () => {
  test("is asked to sign in rather than shown the area", () => {
    renderGuard(null);

    expect(screen.queryByText("Contribution form")).not.toBeInTheDocument();
    expect(screen.getByText("Sign in to use the contribution form")).toBeInTheDocument();
  });

  /**
   * The refusal is rendered in place, never redirected. A redirect decided in
   * the browser happens after the page has already rendered, which is the
   * flash the guards exist to prevent; whole routes are redirected on the
   * server instead.
   */
  test("is not redirected from the browser", () => {
    renderGuard(null);

    expect(replace).not.toHaveBeenCalled();
  });

  test("is offered a sign-in link that returns them here", () => {
    renderGuard(null);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Fwanted%2Fcsc510-final-exam-notes",
    );
  });
});

describe("an account without the capability", () => {
  test("is told what is missing instead of being asked to sign in again", () => {
    renderGuard(anAccountViewModel(), { capability: "transact" });

    expect(screen.queryByText("Contribution form")).not.toBeInTheDocument();
    expect(
      screen.getByText("Your account cannot use the contribution form yet"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Institution verification is needed/)).toBeInTheDocument();
  });

  test("is pointed at the verification route", () => {
    renderGuard(anAccountViewModel(), { capability: "submitClaim" });

    expect(screen.getByRole("link", { name: "Get verified" })).toHaveAttribute(
      "href",
      "/profile/institution-verification",
    );
  });

  /**
   * Email verification and institution verification are deliberately separate
   * trust states and must never be described in the same words
   * (context/ui-context.md).
   */
  test("does not describe a missing email confirmation as institution verification", () => {
    renderGuard(
      anAccountViewModel({
        trust: { email: "unverified", institution: "unverified", restricted: false },
        capabilities: {
          browseMetadata: false,
          transact: false,
          submitClaim: false,
          download: false,
        },
      }),
      { capability: "browseMetadata" },
    );

    expect(screen.getByText("Confirm your email address to browse requests.")).toBeInTheDocument();
    expect(screen.queryByText(/Institution verification is needed/)).not.toBeInTheDocument();
  });
});

/**
 * Signed in is enough when no capability is named, so an unverified account
 * still reaches an area that only needed a session.
 */
test("asks only for a session when no capability is named", () => {
  renderGuard(anAccountViewModel());

  expect(screen.getByText("Contribution form")).toBeInTheDocument();
});

test("states the refusal in text rather than by colour alone", () => {
  renderGuard(null);

  expect(screen.getByText("Restricted")).toBeInTheDocument();
});
