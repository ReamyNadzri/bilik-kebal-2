import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WantedReplies } from "./wanted-replies";

const ID = "11111111-1111-4111-8111-111111111111";
const reply = {
  id: "r1",
  body: "Saw a blue bottle at the library counter.",
  createdAt: "2026-09-24T09:00:00.000Z",
  author: {
    publicId: "22222222-2222-4222-8222-222222222222",
    displayName: "Hafiz",
    avatarUrl: null,
  },
};

function respond(...bodies: unknown[]) {
  const fetchMock = vi.fn();
  for (const body of bodies) {
    fetchMock.mockResolvedValueOnce({ json: async () => body } as unknown as Response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderThread(overrides: Partial<Parameters<typeof WantedReplies>[0]> = {}) {
  return render(
    <WantedReplies
      wantedId={ID}
      kind="missing_item"
      open
      canReply
      isPoster={false}
      now="2026-09-24T12:00:00.000Z"
      {...overrides}
    />,
  );
}

afterEach(() => vi.unstubAllGlobals());

test("lists replies with a link to each author's profile", async () => {
  respond({ ok: true, data: [reply] });
  renderThread();

  expect(await screen.findByText(reply.body)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Hafiz" })).toHaveAttribute(
    "href",
    "/u/22222222-2222-4222-8222-222222222222",
  );
});

test("posts a reply and reloads the thread", async () => {
  const fetchMock = respond(
    { ok: true, data: [] },
    { ok: true, data: { replyId: "r2" } },
    { ok: true, data: [reply] },
  );
  renderThread();
  await screen.findByText("No sightings yet.");

  fireEvent.change(screen.getByLabelText(/Seen it\? Tell the owner/), {
    target: { value: reply.body },
  });
  fireEvent.click(screen.getByRole("button", { name: "Post reply" }));

  expect(await screen.findByText(reply.body)).toBeInTheDocument();
  const [, init] = fetchMock.mock.calls[1]!;
  expect(JSON.parse(String(init?.body))).toEqual({ body: reply.body });
});

test("warns against sharing phone numbers and addresses", async () => {
  respond({ ok: true, data: [] });
  renderThread();

  expect(
    await screen.findByText(/Do not post phone numbers or home addresses/),
  ).toBeInTheDocument();
});

test("asks an unverified viewer to verify instead of offering the form", async () => {
  respond({ ok: true, data: [] });
  renderThread({ canReply: false });

  expect(await screen.findByRole("link", { name: "Verify your institution" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Post reply" })).toBeNull();
});

test("lets only the poster mark the item found", async () => {
  respond({ ok: true, data: [] }, { ok: true, data: { state: "closed" } });
  renderThread({ isPoster: true });

  fireEvent.click(await screen.findByRole("button", { name: "Mark as found" }));

  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(/marked this item as found/),
  );
});
