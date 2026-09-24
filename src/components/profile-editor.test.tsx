import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProfileEditor } from "./profile-editor";
import { AuthProvider } from "@/features/presentation/auth/auth-provider";
import { anAccountViewModel } from "@/features/presentation/test-support/account-view-model";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh }),
  usePathname: () => "/profile",
}));

const account = anAccountViewModel({
  displayName: "Aina",
  publicId: "11111111-1111-4111-8111-111111111111",
  joinedAt: "2026-09-02T02:00:00.000Z",
  trust: { email: "verified", institution: "verified", restricted: false },
  institution: { id: "i", name: "Universiti Teknologi MARA" },
});

function renderEditor() {
  return render(
    <AuthProvider initialAccount={account}>
      <ProfileEditor account={account} bio="Final year CS." postedCount={3} />
    </AuthProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

test("shows the public card: name, badge, institution, joined date, bio and count", () => {
  renderEditor();

  expect(screen.getByRole("heading", { level: 1, name: "Aina" })).toBeInTheDocument();
  expect(screen.getByText("Institution verified")).toBeInTheDocument();
  expect(screen.getByText("Universiti Teknologi MARA")).toBeInTheDocument();
  expect(screen.getByText("September 2026")).toBeInTheDocument();
  expect(screen.getByText("Final year CS.")).toBeInTheDocument();
  expect(screen.getByText("Requests posted")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View public profile" })).toHaveAttribute(
    "href",
    "/u/11111111-1111-4111-8111-111111111111",
  );
});

test("saves a new display name and bio", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      json: async () => ({ ok: true, data: { displayName: "Aina R", bio: "Hi" } }),
    } as unknown as Response)
    .mockResolvedValue({ json: async () => ({ ok: true, data: account }) } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  renderEditor();

  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  fireEvent.change(screen.getByLabelText(/^Display name/), { target: { value: "Aina R" } });
  fireEvent.change(screen.getByLabelText(/^Bio/), { target: { value: "Hi" } });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Profile saved."));
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("/api/profile");
  expect(init?.method).toBe("PATCH");
  expect(JSON.parse(String(init?.body))).toEqual({ displayName: "Aina R", bio: "Hi" });
});

test("opens the picture editor from the picture", () => {
  renderEditor();

  fireEvent.click(screen.getByRole("button", { name: "Change your picture" }));

  expect(screen.getByRole("dialog", { name: "Change your picture" })).toBeInTheDocument();
  expect(screen.getByLabelText(/Choose a photo/)).toHaveAttribute("type", "file");
});
