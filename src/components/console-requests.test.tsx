import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
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
