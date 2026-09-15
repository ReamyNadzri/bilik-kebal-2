import { render, screen } from "@testing-library/react";
import ClaimsPage from "./page";

async function renderPage(params: Record<string, string> = {}) {
  return render(await ClaimsPage({ searchParams: Promise.resolve(params) }));
}

/**
 * `/claims` is Phase 4 Claims and moderation. No read contract exists for it,
 * so it stays fixture-backed and must keep saying so — the marker is retired
 * only in the slice that connects the screen to a real operation
 * (docs/superpowers/plans/2026-09-13-vaultix-mvp-coordination.md §5).
 */
test("still says it is fixture-backed, because it still is", async () => {
  await renderPage();

  expect(screen.getByText("Development only")).toBeInTheDocument();
  expect(screen.getByText(/not connected to a live operation/i)).toBeInTheDocument();
});

test("names the Hunt workspace as the fixture-backed surface", async () => {
  await renderPage();

  expect(screen.getByText(/The Hunt workspace/)).toBeInTheDocument();
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
