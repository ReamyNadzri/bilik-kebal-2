import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NotificationMenu } from "./notification-menu";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  usePathname: () => "/board",
  useRouter: () => ({ refresh }),
}));

const unread = {
  id: "60000000-0000-4000-8000-000000000001",
  kind: "wanted_reply",
  message: "Someone replied to your request. Open it to read the reply.",
  subjectId: "60000000-0000-4000-8000-000000000002",
  createdAt: "2026-09-23T10:00:00.000Z",
  readAt: null,
};
const read = {
  ...unread,
  id: "60000000-0000-4000-8000-000000000003",
  kind: "claim_approved",
  message: "A Sheriff approved your claim. Check your claims for the next step.",
  readAt: "2026-09-23T11:00:00.000Z",
};

function respond(...bodies: unknown[]) {
  const fetchMock = vi.fn();
  for (const body of bodies) fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderMenu(unreadCount = 1) {
  return render(
    <ul>
      <NotificationMenu unreadCount={unreadCount} current={false} />
    </ul>,
  );
}

beforeEach(() => refresh.mockReset());
afterEach(() => vi.unstubAllGlobals());

test("opens the latest notifications in place and closes with Escape", async () => {
  const fetchMock = respond({ ok: true, data: { items: [unread, read], nextCursor: null } });
  renderMenu();

  const bell = screen.getByRole("button", { name: "Notifications, 1 unread" });
  fireEvent.click(bell);

  expect(bell).toHaveAttribute("aria-expanded", "true");
  expect(await screen.findByText(/Someone replied/)).toBeInTheDocument();
  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/notifications?limit=8");
  expect(screen.getByRole("link", { name: "See all notifications" })).toHaveAttribute(
    "href",
    "/notifications",
  );

  fireEvent.keyDown(screen.getByText(/Someone replied/), { key: "Escape" });
  expect(bell).toHaveAttribute("aria-expanded", "false");
  expect(bell).toHaveFocus();
});

test("opening an unread notification marks it read and drops the badge", async () => {
  const fetchMock = respond(
    { ok: true, data: { items: [unread], nextCursor: null } },
    { ok: true, data: { read: true } },
  );
  renderMenu();
  fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));

  const link = await screen.findByRole("link", { name: /Someone replied/ });
  expect(link).toHaveAttribute("href", `/wanted/${unread.subjectId}`);
  fireEvent.click(link);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1]?.[1]).toEqual(
    expect.objectContaining({ method: "PATCH", body: JSON.stringify({ id: unread.id }) }),
  );
  expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  await waitFor(() => expect(refresh).toHaveBeenCalled());
});

test("marks everything read at once", async () => {
  const fetchMock = respond(
    { ok: true, data: { items: [unread], nextCursor: null } },
    { ok: true, data: { read: true } },
  );
  renderMenu(3);
  fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
  await screen.findByText(/Someone replied/);

  fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));

  await waitFor(() =>
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ all: true }) }),
    ),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument(),
  );
  expect(screen.getByRole("button", { name: "Mark all read" })).toBeDisabled();
});

test("says so when the latest notifications cannot be loaded, and retries", async () => {
  respond(
    { ok: false, code: "NOTIFICATIONS_UNAVAILABLE", message: "" },
    { ok: true, data: { items: [], nextCursor: null } },
  );
  renderMenu(0);
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

  const alert = await screen.findByRole("alert");
  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No notifications yet.")).toBeInTheDocument();
});
