import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { OwnPrivacyRequest } from "@/contracts/legal";
import { ProfilePrivacyRequests } from "./profile-privacy-requests";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const fetchMock = vi.fn();

function answer(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok: status < 400,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  });
}

function request(overrides: Partial<OwnPrivacyRequest> = {}): OwnPrivacyRequest {
  return {
    id: crypto.randomUUID(),
    kind: "access",
    details: "Please send me a copy of my data.",
    status: "open",
    answer: null,
    createdAt: "2026-10-03T02:00:00.000Z",
    answeredAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

test("checks the details before sending anything", async () => {
  render(<ProfilePrivacyRequests requests={[]} />);

  fireEvent.change(screen.getByLabelText(/Details/), { target: { value: "short" } });
  fireEvent.click(screen.getByRole("button", { name: "Send request" }));

  expect(await screen.findByText(/Describe your request in 10 to 2,000 characters/)).toBeVisible();
  expect(screen.getByLabelText(/Details/)).toHaveAttribute("aria-invalid", "true");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("sends the request to the Owner and says where the answer will appear", async () => {
  answer({ ok: true, data: { id: "r1" } });
  render(<ProfilePrivacyRequests requests={[]} />);

  fireEvent.change(screen.getByLabelText("What do you need?"), {
    target: { value: "correction" },
  });
  fireEvent.change(screen.getByLabelText(/Details/), {
    target: { value: "My display name is spelled wrongly." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send request" }));

  expect(await screen.findByRole("status")).toHaveTextContent(/answer will appear below/);
  expect(refresh).toHaveBeenCalled();
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/profile/privacy-requests");
  expect(JSON.parse(String(init.body))).toEqual({
    kind: "correction",
    details: "My display name is spelled wrongly.",
  });
});

test("shows a refusal in plain words", async () => {
  answer(
    {
      ok: false,
      code: "RATE_LIMITED",
      message: "You have 3 requests waiting for an answer. Wait for one to be answered first.",
    },
    429,
  );
  render(<ProfilePrivacyRequests requests={[]} />);

  fireEvent.change(screen.getByLabelText(/Details/), {
    target: { value: "Please delete my old bio." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send request" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/3 requests waiting/);
  await waitFor(() => expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled());
});

test("lists requests with their state and the Owner's answer", () => {
  render(
    <ProfilePrivacyRequests
      requests={[
        request({
          status: "answered",
          answer: "Your data is below.",
          answeredAt: "2026-10-04T02:00:00.000Z",
        }),
        request({ kind: "deletion", details: "Delete my bio." }),
      ]}
    />,
  );

  const list = screen.getByRole("list", { name: "Your privacy requests" });
  const items = within(list).getAllByRole("listitem");
  expect(items[0]).toHaveTextContent("A copy of my data");
  expect(items[0]).toHaveTextContent("Your data is below.");
  expect(items[0]).toHaveTextContent("Answered");
  expect(items[1]).toHaveTextContent("Delete some of my data");
  expect(items[1]).toHaveTextContent("Waiting");
});

test("replaces the form with an explanation while three requests wait", () => {
  render(<ProfilePrivacyRequests requests={[request(), request(), request()]} />);

  expect(screen.queryByRole("button", { name: "Send request" })).not.toBeInTheDocument();
  expect(screen.getByText(/You have 3 requests waiting for an answer/)).toBeInTheDocument();
});

test("says so when the requests could not be loaded", () => {
  render(<ProfilePrivacyRequests requests={null} />);
  expect(screen.getByText("Your requests could not be loaded right now.")).toBeInTheDocument();
});
