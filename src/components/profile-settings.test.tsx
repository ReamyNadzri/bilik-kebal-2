import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfileSettings } from "./profile-settings";
import { AuthProvider } from "@/features/presentation/auth/auth-provider";
import { anAccountViewModel } from "@/features/presentation/test-support/account-view-model";

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
        allowance={{ base: 3, bonus: 0, used: 1, remaining: 2 }}
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
    screen.getByText("UiTM Shah Alam, confirmed automatically through your UiTM email domain."),
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

  expect(screen.getByText(/You have 2 free requests left/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Reward code"), { target: { value: "RAYA2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Redeem" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Code redeemed."));
  expect(screen.getByText(/You have 4 free requests left/)).toBeInTheDocument();

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
