import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { ConsoleMember } from "@/contracts/console";
import { MemberConsole } from "./member-console";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

const member: ConsoleMember = {
  publicId: "11111111-1111-4111-8111-111111111111",
  displayName: "Hafiz",
  email: "hafiz@example.test",
  joinedAt: "2026-09-01T00:00:00.000Z",
  emailVerified: true,
  institution: { id: "i1", name: "UiTM", state: "verified" },
  roles: [],
  restriction: null,
  badge: null,
};

function queue(...bodies: unknown[]) {
  const mock = vi.fn();
  for (const body of bodies) mock.mockResolvedValueOnce({ json: async () => body });
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

function renderConsole(role: "owner" | "platform_sheriff" | "institution_sheriff", m = member) {
  render(
    <MemberConsole
      role={role}
      members={[m]}
      query=""
      institutions={[{ id: "i1", name: "UiTM" }]}
      badges={[]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Manage" }));
}

test("an institution Sheriff is offered a timeout but not renames, verification or roles", () => {
  renderConsole("institution_sheriff");
  expect(screen.getByRole("form", { name: "Time out" })).toBeInTheDocument();
  expect(screen.queryByRole("form", { name: "Change display name" })).not.toBeInTheDocument();
  expect(screen.queryByRole("form", { name: "Institution verification" })).not.toBeInTheDocument();
  expect(screen.queryByRole("form", { name: "Sheriff role" })).not.toBeInTheDocument();
});

test("the Owner is offered every action, including permanent restriction and badges", () => {
  renderConsole("owner");
  for (const name of [
    "Time out",
    "Restrict permanently",
    "Change display name",
    "Institution verification",
    "Sheriff role",
    "Badge",
  ]) {
    expect(screen.getByRole("form", { name })).toBeInTheDocument();
  }
});

test("times a member out with a duration and reason code", async () => {
  const fetchMock = queue({ ok: true, data: { done: true } });
  renderConsole("platform_sheriff");
  const form = screen.getByRole("form", { name: "Time out" });
  fireEvent.change(within(form).getByLabelText("For"), { target: { value: "168" } });
  fireEvent.change(within(form).getByLabelText("Reason code"), { target: { value: "spam" } });
  fireEvent.click(within(form).getByRole("button", { name: "Time out" }));

  await waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(fetchMock.mock.calls[0]![0]).toBe(`/api/console/members/${member.publicId}`);
  expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({
    action: "timeout",
    hours: 168,
    reasonCode: "spam",
  });
});

test("rejects a malformed reason code before sending", () => {
  const fetchMock = queue();
  renderConsole("platform_sheriff");
  const form = screen.getByRole("form", { name: "Time out" });
  fireEvent.change(within(form).getByLabelText("Reason code"), { target: { value: "Spam!" } });
  fireEvent.click(within(form).getByRole("button", { name: "Time out" }));
  expect(within(form).getByRole("alert")).toHaveTextContent(/reason code/);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("asks for the password in place when the step-up lapsed, then retries", async () => {
  const fetchMock = queue(
    { ok: false, code: "RECENT_AUTH_REQUIRED", message: "" },
    { ok: true, data: { next: "profile" } },
    { ok: true, data: { done: true } },
  );
  renderConsole("platform_sheriff");
  const form = screen.getByRole("form", { name: "Time out" });
  fireEvent.change(within(form).getByLabelText("Reason code"), { target: { value: "spam" } });
  fireEvent.click(within(form).getByRole("button", { name: "Time out" }));

  fireEvent.change(await within(form).findByLabelText("Password"), { target: { value: "pw" } });
  fireEvent.click(within(form).getByRole("button", { name: "Confirm and continue" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(fetchMock.mock.calls[2]![0]).toBe(`/api/console/members/${member.publicId}`);
});

test("shows a running timeout and offers to end it", () => {
  renderConsole("platform_sheriff", {
    ...member,
    restriction: {
      reasonCode: "spam",
      restrictedAt: "2026-09-25T00:00:00.000Z",
      expiresAt: "2026-09-26T00:00:00.000Z",
    },
  });
  expect(screen.getByText(/Timed out until/)).toBeInTheDocument();
  expect(screen.getByRole("form", { name: "End the timeout now" })).toBeInTheDocument();
});

test("a Sheriff cannot manage the Owner", () => {
  render(
    <MemberConsole
      role="platform_sheriff"
      members={[{ ...member, roles: ["owner"] }]}
      query=""
      institutions={[]}
      badges={[]}
    />,
  );
  expect(screen.queryByRole("button", { name: "Manage" })).not.toBeInTheDocument();
});
