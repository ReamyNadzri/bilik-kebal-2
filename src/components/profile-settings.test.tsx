import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfileSettings } from "./profile-settings";
import { AuthProvider } from "@/features/presentation/auth/auth-provider";
import { anAccountViewModel } from "@/features/presentation/test-support/account-view-model";
import { clerkHooks } from "@/features/presentation/test-support/clerk-hooks";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh }),
  usePathname: () => "/profile",
}));

const account = anAccountViewModel({
  displayName: "Aina",
  email: "2023456789@student.uitm.edu.my",
  publicId: "11111111-1111-4111-8111-111111111111",
  avatarPreset: 1,
  avatarUrl: "/brand/avatar-1.webp",
  trust: { email: "verified", institution: "verified", restricted: false },
  institution: { id: "i", name: "UiTM Shah Alam" },
});

function respond(body: unknown) {
  return { json: async () => body } as unknown as Response;
}

function renderSettings(overrides: Partial<Parameters<typeof ProfileSettings>[0]> = {}) {
  return render(
    <AuthProvider initialAccount={account}>
      <ProfileSettings
        account={account}
        bio="Final year CS."
        nameAllowance={{ base: 2, bonus: 0, used: 0, remaining: 2 }}
        now="2026-10-02T00:00:00.000Z"
        entryRequests={[]}
        {...overrides}
      />
    </AuthProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

test("shows the name and a read-only email, never an editable address", () => {
  renderSettings();

  expect(screen.getByRole("heading", { level: 2, name: "Your details" })).toBeInTheDocument();
  expect(screen.getByLabelText("Display name")).toHaveValue("Aina");
  const email = screen.getByLabelText("Email address");
  expect(email).toHaveValue("2023456789@student.uitm.edu.my");
  expect(email).toHaveAttribute("readonly");
  expect(screen.getByText(/never your email address/)).toBeInTheDocument();
});

test("marks the chosen drawn avatar and saves a new one", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(respond({ ok: true, data: { avatarUrl: "/brand/avatar-4.webp" } }))
    .mockResolvedValue(respond({ ok: true, data: account }));
  vi.stubGlobal("fetch", fetchMock);
  renderSettings();

  expect(screen.getByRole("button", { name: "Drawn avatar 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Drawn avatar 5" }));

  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Avatar saved."));
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/profile/avatar/preset",
    expect.objectContaining({ body: JSON.stringify({ preset: 4 }) }),
  );
  expect(screen.getByRole("button", { name: "Drawn avatar 5" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("shows both trust states, with how the institution was confirmed", () => {
  renderSettings();

  expect(screen.getByText("Email verified")).toBeInTheDocument();
  expect(
    screen.getByText(
      "UiTM Shah Alam, confirmed automatically through your university email domain.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Institution verified", { selector: ".status-stamp" }),
  ).toBeInTheDocument();
});

test("offers Save only once something has changed", () => {
  renderSettings();

  expect(screen.queryByRole("button", { name: "Save profile" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Aina R" } });
  expect(screen.getByRole("button", { name: "Save profile" })).toBeInTheDocument();
});

test("redeems a reward code and says why a code was refused", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(respond({ ok: true, data: { outcome: "redeemed", remaining: 4 } }))
    .mockResolvedValueOnce(
      respond({ ok: true, data: { outcome: "already_redeemed", remaining: 4 } }),
    );
  vi.stubGlobal("fetch", fetchMock);
  renderSettings();

  expect(screen.getByRole("heading", { name: "Redeem Code" })).toBeInTheDocument();
  expect(screen.queryByText(/free requests/)).toBeNull();
  fireEvent.change(screen.getByLabelText("Reward code"), { target: { value: "RAYA2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Redeem" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Code redeemed."));
  expect(refresh).toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Reward code"), { target: { value: "RAYA2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Redeem" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("already redeemed this code"),
  );
});

test("lists the entries the member asked a Sheriff to add, with the decision", () => {
  renderSettings({
    entryRequests: [
      {
        id: "r1",
        category: "course",
        label: "Data Structures",
        courseCode: "CSC508",
        parentName: "Computer Science",
        note: null,
        state: "approved",
        decisionNote: null,
        createdAt: "2026-09-20T02:00:00.000Z",
        decidedAt: "2026-09-21T02:00:00.000Z",
      },
    ],
  });

  expect(screen.getByText("CSC508 Data Structures")).toBeInTheDocument();
  expect(screen.getByText("Added")).toBeInTheDocument();
});

describe("Google photo", () => {
  const googleUser = {
    externalAccounts: [
      {
        provider: "google",
        imageUrl: "https://img.clerk.com/google-photo",
        verification: { status: "verified" },
      },
    ],
  };

  test("is offered to a Google member on another picture, and saved", async () => {
    clerkHooks.user = googleUser;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        respond({ ok: true, data: { avatarUrl: "https://img.clerk.com/google-photo" } }),
      )
      .mockResolvedValue(respond({ ok: true, data: account }));
    vi.stubGlobal("fetch", fetchMock);
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Use my Google photo" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Your Google photo is your picture again.",
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/profile/avatar/google", expect.anything());
    expect(screen.queryByRole("button", { name: "Use my Google photo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drawn avatar 2" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("is not offered to a member who signed in with email only", () => {
    clerkHooks.user = { externalAccounts: [] };
    renderSettings();

    expect(screen.queryByRole("button", { name: "Use my Google photo" })).not.toBeInTheDocument();
  });
});

test("says how many name changes are left, and locks the name when none are", () => {
  const { unmount } = renderSettings();
  expect(screen.getByText("You can change it 2 more times.")).toBeInTheDocument();
  expect(screen.getByLabelText("Display name")).not.toHaveAttribute("readonly");
  unmount();

  renderSettings({ nameAllowance: { base: 2, bonus: 0, used: 2, remaining: 0 } });
  expect(screen.getByText(/You have used your name changes/)).toBeInTheDocument();
  expect(screen.getByLabelText("Display name")).toHaveAttribute("readonly");
});

describe("deleting the account", () => {
  const young = anAccountViewModel({ ...account, joinedAt: "2026-09-20T00:00:00.000Z" });
  const old = anAccountViewModel({ ...account, joinedAt: "2026-08-01T00:00:00.000Z" });

  test("before 30 days, says when it opens only once Delete is pressed", () => {
    renderSettings({ account: young });

    expect(screen.queryByText(/can be deleted from/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your account can be deleted from 20 Oct 2026, 30 days after it was created.",
    );
    expect(screen.queryByLabelText(/Type DELETE to confirm/)).toBeNull();
  });

  test("after 30 days, asks for DELETE and calls the deletion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond({ ok: true, data: { deleted: true } }));
    vi.stubGlobal("fetch", fetchMock);
    renderSettings({ account: old });

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const confirm = screen.getByRole("button", { name: "Delete my account" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/), {
      target: { value: "delete" },
    });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/profile/account",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  test("shows the server's refusal and keeps the account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respond({
          ok: false,
          code: "ACCOUNT_HAS_OPEN_ITEMS",
          message: "Your account cannot be deleted yet: a claim of yours is being reviewed.",
        }),
      ),
    );
    renderSettings({ account: old });

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("cannot be deleted yet");
    expect(screen.getByRole("button", { name: "Keep my account" })).toBeInTheDocument();
  });
});
