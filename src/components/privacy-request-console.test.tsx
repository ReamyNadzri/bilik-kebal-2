import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PrivacyRequestItem } from "@/contracts/legal";
import { PrivacyRequestConsole } from "./privacy-request-console";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const fetchMock = vi.fn();
const id = "33333333-3333-4333-8333-333333333333";

const open: PrivacyRequestItem = {
  id,
  kind: "access",
  details: "Please send me a copy of my data.",
  status: "open",
  answer: null,
  createdAt: "2026-10-03T02:00:00.000Z",
  answeredAt: null,
  memberPublicId: "11111111-1111-4111-8111-111111111111",
  memberDisplayName: "Aina",
};

beforeEach(() => {
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

test("lists a waiting request with the member's public profile", () => {
  render(<PrivacyRequestConsole open={[open]} answered={[]} />);

  expect(screen.getByRole("heading", { name: "Waiting for an answer (1)" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Aina" })).toHaveAttribute(
    "href",
    "/u/11111111-1111-4111-8111-111111111111",
  );
  expect(screen.getByText("Please send me a copy of my data.")).toBeInTheDocument();
});

test("needs an answer, then sends it for that request", async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ ok: true, data: { done: true } }),
  });
  render(<PrivacyRequestConsole open={[open]} answered={[]} />);

  fireEvent.click(screen.getByRole("button", { name: "Send answer" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Write the answer the member will read.",
  );
  expect(fetchMock).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Answer to Aina"), {
    target: { value: "Your data is attached below." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send answer" }));

  await waitFor(() => expect(refresh).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe(`/api/console/privacy-requests/${id}/answer`);
  expect(JSON.parse(String(init.body))).toEqual({ answer: "Your data is attached below." });
});

test("shows answered requests with their answer, and an empty queue plainly", () => {
  render(
    <PrivacyRequestConsole
      open={[]}
      answered={[
        { ...open, status: "answered", answer: "Sent.", answeredAt: "2026-10-04T02:00:00.000Z" },
      ]}
    />,
  );

  expect(screen.getByText("No privacy requests are waiting.")).toBeInTheDocument();
  expect(screen.getByText("Sent.")).toBeInTheDocument();
});
