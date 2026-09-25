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

test("lets the poster of a paid request name a replier for a Sheriff to approve", async () => {
  const fetchMock = respond(
    { ok: true, data: [reply] },
    { ok: true, data: { requestId: "p1", state: "pending" } },
  );
  renderThread({ isPoster: true, bountySen: 2000 });

  await screen.findByText(reply.body);
  fireEvent.change(screen.getByLabelText("Who helped you?"), {
    target: { value: reply.author.publicId },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask a Sheriff to release the bounty" }));

  await waitFor(() =>
    expect(screen.getByText(/A Sheriff is reviewing your bounty release/)).toBeInTheDocument(),
  );
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/marketplace/wanted/${ID}/payout-request`,
    expect.objectContaining({ body: JSON.stringify({ finderPublicId: reply.author.publicId }) }),
  );
});

test("offers no bounty release on a free request or to anyone but the poster", async () => {
  respond({ ok: true, data: [reply] }, { ok: true, data: [reply] });
  const { unmount } = renderThread({ isPoster: true, bountySen: 0 });
  await screen.findByText(reply.body);
  expect(screen.queryByText("Release the bounty")).toBeNull();
  unmount();

  renderThread({ isPoster: false, bountySen: 2000 });
  await screen.findByText(reply.body);
  expect(screen.queryByText("Release the bounty")).toBeNull();
});

describe("retention and live updates", () => {
  const closedThread = {
    replyCount: 1,
    closedAt: "2026-09-22T12:00:00.000Z",
    autoClosed: false,
    vanishesAt: "2026-09-29T12:00:00.000Z",
    reopenUntil: "2026-09-29T12:00:00.000Z",
    clearedAt: null,
  };

  test("tells readers of an open thread that it is deleted 7 days after it is found", async () => {
    respond({ ok: true, data: [] });
    renderThread();
    expect(
      await screen.findByText(/stays on the Board for 7 days and is then deleted/),
    ).toBeInTheDocument();
  });

  test("says when a found item leaves the Board and lets the poster reopen it", async () => {
    const fetchMock = respond(
      { ok: true, data: [reply] },
      { ok: true, data: { state: "open" } },
      { ok: true, data: [reply] },
    );
    renderThread({ open: false, isPoster: true, thread: closedThread });

    expect(
      await screen.findByText("This chat and the request leave the Board in 5 days."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not found after all? Reopen" }));

    expect(await screen.findByRole("button", { name: "Mark as found" })).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[1]![0])).toMatch(/\/reopen$/);
  });

  test("offers no reopen once the 7 days are over", async () => {
    respond({ ok: true, data: [reply] });
    renderThread({
      open: false,
      isPoster: true,
      thread: { ...closedThread, reopenUntil: "2026-09-23T12:00:00.000Z" },
    });
    await screen.findByText(reply.body);
    expect(screen.queryByRole("button", { name: /Reopen/ })).not.toBeInTheDocument();
  });

  test("says the messages were deleted once the thread is cleared", () => {
    respond({ ok: true, data: [] });
    renderThread({
      open: false,
      thread: { ...closedThread, vanishesAt: null, clearedAt: "2026-09-29T12:00:00.000Z" },
    });
    expect(screen.getByText(/deleted 7 days after it closed/)).toBeInTheDocument();
  });

  test("offers a retry when the thread cannot be loaded", async () => {
    respond(
      {
        ok: false,
        code: "MARKETPLACE_UNAVAILABLE",
        message: "Replies are temporarily unavailable.",
      },
      { ok: true, data: [reply] },
    );
    renderThread();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText(reply.body)).toBeInTheDocument();
  });

  test("checks for new messages every 15 seconds while open, keeping the list on a failed check", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      respond(
        { ok: true, data: [] },
        { ok: true, data: [reply] },
        { ok: false, code: "MARKETPLACE_UNAVAILABLE", message: "" },
      );
      renderThread();
      await screen.findByText("No sightings yet.");

      await vi.advanceTimersByTimeAsync(15_000);
      expect(await screen.findByText(reply.body)).toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(15_000);
      expect(await screen.findByText(/New messages could not be checked/)).toBeInTheDocument();
      expect(screen.getByText(reply.body)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  test("an academic bounty takes questions, warns against links, and has no found button", async () => {
    respond({ ok: true, data: [] });
    renderThread({ kind: "academic", isPoster: true, bountySen: 1000 });

    expect(await screen.findByText("No questions yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Questions" })).toBeInTheDocument();
    expect(
      screen.getByText(/Links, email addresses and chat handles are not allowed/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark as/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Release the bounty")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post question" })).toBeInTheDocument();
  });
});

describe("reply, edit, delete and hide", () => {
  const mine = {
    ...reply,
    id: "33333333-3333-4333-8333-333333333333",
    body: "I think it was on level 2.",
    createdAt: "2026-09-24T11:55:00.000Z",
    author: { publicId: "me-public", displayName: "Me", avatarUrl: null },
    editedAt: null,
    deleted: false,
    parent: null,
  };

  test("replies to a message by quoting it", async () => {
    const fetchMock = respond(
      { ok: true, data: [reply] },
      { ok: true, data: { replyId: "r3" } },
      { ok: true, data: [reply] },
    );
    renderThread();
    fireEvent.click(await screen.findByRole("button", { name: "Reply" }));
    expect(screen.getByText(/Replying to Hafiz/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Seen it\? Tell the owner/), {
      target: { value: "Which counter?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post reply" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toEqual({
      body: "Which counter?",
      parentId: "r1",
    });
  });

  test("shows the quoted message and marks edited and deleted messages", async () => {
    respond({
      ok: true,
      data: [
        { ...mine, editedAt: "2026-09-24T11:58:00.000Z" },
        {
          ...reply,
          id: "r4",
          body: "",
          deleted: true,
          editedAt: null,
          parent: { id: mine.id, authorName: "Me", excerpt: "I think", deleted: false },
        },
      ],
    });
    renderThread({ viewerPublicId: "me-public" });

    expect(await screen.findByText(/· edited/)).toBeInTheDocument();
    expect(screen.getByText("Message deleted")).toBeInTheDocument();
    expect(screen.getByText("Replying to Me: “I think”")).toBeInTheDocument();
  });

  test("edits your own message within 15 minutes", async () => {
    const fetchMock = respond(
      { ok: true, data: [mine] },
      { ok: true, data: { state: "edited" } },
      { ok: true, data: [{ ...mine, body: "Level 3, actually." }] },
    );
    renderThread({ viewerPublicId: "me-public" });

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit your message"), {
      target: { value: "Level 3, actually." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("Level 3, actually.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]![0]).toBe(`/api/marketplace/replies/${mine.id}`);
    expect(fetchMock.mock.calls[1]![1]?.method).toBe("PATCH");
  });

  test("offers no edit after 15 minutes, but still delete", async () => {
    respond({ ok: true, data: [{ ...mine, createdAt: "2026-09-24T11:40:00.000Z" }] });
    renderThread({ viewerPublicId: "me-public" });

    expect(await screen.findByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  test("asks before deleting your own message", async () => {
    const fetchMock = respond(
      { ok: true, data: [mine] },
      { ok: true, data: { state: "deleted" } },
      { ok: true, data: [{ ...mine, body: "", deleted: true }] },
    );
    renderThread({ viewerPublicId: "me-public" });

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete message" }));

    expect(await screen.findByText("Message deleted")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]![0]).toBe(`/api/marketplace/replies/${mine.id}/delete`);
  });

  test("never offers edit or delete on someone else's message", async () => {
    respond({ ok: true, data: [reply] });
    renderThread({ viewerPublicId: "me-public" });
    await screen.findByText(reply.body);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide" })).not.toBeInTheDocument();
  });

  test("lets a moderator hide a message with a reason code", async () => {
    const fetchMock = respond(
      { ok: true, data: [reply] },
      { ok: true, data: { state: "hidden" } },
      { ok: true, data: [] },
    );
    renderThread({ canModerate: true });

    fireEvent.click(await screen.findByRole("button", { name: "Hide" }));
    fireEvent.change(screen.getByLabelText(/Reason code/), { target: { value: "Personal info" } });
    fireEvent.click(screen.getByRole("button", { name: "Hide message" }));
    expect(await screen.findByText(/Enter a reason code/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Reason code/), { target: { value: "personal_info" } });
    fireEvent.click(screen.getByRole("button", { name: "Hide message" }));
    expect(await screen.findByText("No sightings yet.")).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).toEqual({
      hide: true,
      reasonCode: "personal_info",
    });
  });
});
