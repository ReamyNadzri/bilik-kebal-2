import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { TaxonomyRequestView } from "@/contracts/taxonomy-requests";
import { ConsoleRequests } from "./console-requests";

const entry: TaxonomyRequestView = {
  id: "70000000-0000-4000-8000-000000000001",
  category: "campus",
  label: "UiTM Tapah",
  courseCode: null,
  parentName: null,
  note: null,
  state: "pending",
  decisionNote: null,
  createdAt: "2026-09-25T00:00:00.000Z",
  decidedAt: null,
  requesterName: "Aina",
};

test("lists a Sheriff's own campus request, labelled, with its decisions switched off", () => {
  render(
    <ConsoleRequests
      entries={[
        { ...entry, ownRequest: true },
        { ...entry, id: "70000000-0000-4000-8000-000000000002", label: "UiTM Arau" },
      ]}
      releases={[]}
    />,
  );

  const [own, other] = screen.getAllByRole("listitem");
  expect(within(own!).getByText("UiTM Tapah")).toBeInTheDocument();
  expect(within(own!).getByText(/You asked for this/)).toBeInTheDocument();
  expect(within(own!).getByRole("button", { name: "Add to the list" })).toBeDisabled();
  expect(within(own!).getByRole("button", { name: "Decline" })).toBeDisabled();
  expect(within(other!).getByRole("button", { name: "Add to the list" })).toBeEnabled();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("lets the Owner decide their own entry request and posts the decision", async () => {
  const fetchMock = vi.fn(async () => Response.json({ ok: true, data: { state: "approved" } }));
  vi.stubGlobal("fetch", fetchMock);
  render(
    <ConsoleRequests entries={[{ ...entry, ownRequest: true }]} releases={[]} viewerRole="owner" />,
  );

  expect(screen.getByText(/As the Owner, you can decide it yourself/)).toBeInTheDocument();
  const add = screen.getByRole("button", { name: "Add to the list" });
  expect(add).toBeEnabled();
  fireEvent.click(add);

  expect(await screen.findByRole("status")).toHaveTextContent("Added “UiTM Tapah”");
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/sheriff/taxonomy-requests/${entry.id}`,
    expect.objectContaining({ method: "POST" }),
  );
  const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
  const body: unknown = JSON.parse(String(init.body));
  expect(body).toEqual({ approve: true, note: "", openRegion: false });
  expect(screen.queryByRole("button", { name: "Add to the list" })).not.toBeInTheDocument();
});

test("keeps a Sheriff's own entry request switched off even with a role", () => {
  render(
    <ConsoleRequests
      entries={[{ ...entry, ownRequest: true }]}
      releases={[]}
      viewerRole="platform_sheriff"
    />,
  );
  expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
});
