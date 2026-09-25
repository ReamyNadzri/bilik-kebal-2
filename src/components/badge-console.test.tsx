import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { ConsoleBadge, ConsoleMember } from "@/contracts/console";
import { BadgeConsole } from "./badge-console";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

const badge: ConsoleBadge = {
  id: "b0000000-0000-4000-8000-000000000001",
  name: "Trailblazer",
  description: null,
  imageUrl: null,
  retired: false,
  holders: 1,
};

const member = (publicId: string, displayName: string, worn: ConsoleBadge | null = null) =>
  ({
    publicId,
    displayName,
    email: null,
    joinedAt: "2026-09-01T00:00:00.000Z",
    emailVerified: true,
    institution: null,
    roles: [],
    restriction: null,
    badge: worn ? { id: worn.id, name: worn.name } : null,
  }) satisfies ConsoleMember;

const aina = member("11111111-1111-4111-8111-111111111111", "Aina");
const hafiz = member("22222222-2222-4222-8222-222222222222", "Hafiz", badge);

function queue(...bodies: unknown[]) {
  const mock = vi.fn();
  for (const body of bodies) mock.mockResolvedValueOnce({ json: async () => body });
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

test("awards a badge to a member chosen from the dropdown", async () => {
  const fetchMock = queue({ ok: true, data: { done: true } });
  render(<BadgeConsole badges={[badge]} members={[aina, hafiz]} />);

  const select = screen.getByLabelText("Award to");
  // Someone already wearing it is not offered again.
  expect(within(select).queryByRole("option", { name: "Hafiz" })).toBeNull();
  fireEvent.change(select, { target: { value: aina.publicId } });
  fireEvent.click(screen.getByRole("button", { name: "Award" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Awarded “Trailblazer” to Aina.");
  expect(fetchMock.mock.calls[0]![0]).toBe(`/api/console/members/${aina.publicId}`);
  expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({
    action: "set_badge",
    badgeId: badge.id,
  });
  expect(refresh).toHaveBeenCalled();
});

test("asks who should wear it before sending", () => {
  const fetchMock = queue();
  render(<BadgeConsole badges={[badge]} members={[aina]} />);
  fireEvent.click(screen.getByRole("button", { name: "Award" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Choose who should wear");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("takes a badge off a wearer, after the password step-up", async () => {
  const fetchMock = queue(
    { ok: false, code: "RECENT_AUTH_REQUIRED", message: "" },
    { ok: true, data: { next: "profile" } },
    { ok: true, data: { done: true } },
  );
  render(<BadgeConsole badges={[badge]} members={[aina, hafiz]} />);
  const wearers = screen.getByRole("list", { name: "Wearing Trailblazer" });
  fireEvent.click(within(wearers).getByRole("button", { name: /^Remove\s*from Hafiz$/ }));

  fireEvent.change(await screen.findByLabelText("Password"), { target: { value: "pw" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm and continue" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(JSON.parse(String(fetchMock.mock.calls[2]![1]?.body))).toEqual({
    action: "set_badge",
    badgeId: null,
  });
  expect(await screen.findByRole("status")).toHaveTextContent("Took “Trailblazer” off Hafiz.");
});
