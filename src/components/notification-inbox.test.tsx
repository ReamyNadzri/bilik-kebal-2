import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { NotificationInbox } from "./notification-inbox";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => vi.unstubAllGlobals());

test("loads notifications and marks one read", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          items: [
            {
              id: "60000000-0000-4000-8000-000000000001",
              kind: "claim_approved",
              message: "A Sheriff approved your claim. Check your claims for the next step.",
              subjectId: "60000000-0000-4000-8000-000000000002",
              createdAt: "2026-09-23T10:00:00.000Z",
              readAt: null,
            },
          ],
          nextCursor: null,
        },
      }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: { read: true } }) });
  vi.stubGlobal("fetch", fetchMock);

  render(<NotificationInbox />);
  const notice = await screen.findByText(/Sheriff approved your claim/);
  fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/notifications");
  expect(fetchMock.mock.calls[1]?.[1]).toEqual(
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ id: "60000000-0000-4000-8000-000000000001" }),
    }),
  );
  await waitFor(() => expect(notice.closest("li")).toHaveAttribute("data-read", "true"));
  // The rail's badge is server-rendered; refreshing is what makes it drop.
  expect(refresh).toHaveBeenCalled();
});

test("shows an empty inbox", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { items: [], nextCursor: null } }),
    }),
  );
  render(<NotificationInbox />);
  expect(await screen.findByRole("heading", { name: "No notifications yet" })).toBeInTheDocument();
});

test("offers retry when notifications cannot be loaded", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<NotificationInbox />);
  expect(
    await screen.findByRole("heading", { name: "Notifications are unavailable" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});

test("passes the server cursor through unchanged when loading another page", async () => {
  const cursor = "opaque-cursor-from-server";
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          items: [
            {
              id: "60000000-0000-4000-8000-000000000003",
              kind: "claim_rejected",
              message: "A Sheriff rejected your claim. Check your claims for details.",
              subjectId: "60000000-0000-4000-8000-000000000004",
              createdAt: "2026-09-23T11:00:00.000Z",
              readAt: "2026-09-23T11:01:00.000Z",
            },
          ],
          nextCursor: cursor,
        },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: { items: [], nextCursor: null } }),
    });
  vi.stubGlobal("fetch", fetchMock);

  render(<NotificationInbox />);
  await screen.findByText(/Sheriff rejected your claim/);
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(String(fetchMock.mock.calls[1]?.[0])).toContain(`cursor=${cursor}`);
});

test("links a reply notification to the request it is about", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          items: [
            {
              id: "60000000-0000-4000-8000-000000000003",
              kind: "wanted_reply",
              message: "Someone replied to your request. Open it to read the reply.",
              subjectId: "11111111-1111-4111-8111-111111111111",
              createdAt: "2026-09-24T10:00:00.000Z",
              readAt: null,
            },
          ],
          nextCursor: null,
        },
      }),
    }),
  );

  render(<NotificationInbox />);

  expect(await screen.findByRole("link", { name: "Open" })).toHaveAttribute(
    "href",
    "/wanted/11111111-1111-4111-8111-111111111111",
  );
  expect(screen.getByText("New")).toBeInTheDocument();
});
