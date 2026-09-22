import { render, screen } from "@testing-library/react";
import ClaimsPage from "./page";

async function renderPage(params: Record<string, string> = {}) {
  return render(await ClaimsPage({ searchParams: Promise.resolve(params) }));
}

test("prompts unauthenticated visitors to sign in to claim bounties", async () => {
  await renderPage();

  expect(screen.getByText("Sign in to submit and track claims")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
});

test("renders the Hunter's Office masthead", async () => {
  await renderPage();

  expect(
    screen.getByRole("heading", { name: "Take a hunt, claim the bounty" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Open hunts" })).toBeInTheDocument();
});

test("keeps its own development preview states, which the connected routes no longer need", async () => {
  await renderPage({ preview: "unavailable" });

  expect(screen.getByRole("heading", { name: "Hunt could not be loaded" })).toBeInTheDocument();
});

test("claims no payment, entitlement or file access", async () => {
  const { container } = await renderPage();
  const shown = container.textContent ?? "";

  expect(shown).not.toMatch(/payment (received|complete|confirmed)/i);
  expect(shown).not.toMatch(/download now|your file is|you now have access/i);
});
