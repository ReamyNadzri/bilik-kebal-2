import { render, screen } from "@testing-library/react";
import { AppShell } from "./app-shell";
import { SHERIFF_CONSOLE_NAV } from "@/features/presentation/navigation";

test("provides keyboard-first navigation landmarks", () => {
  render(
    <AppShell>
      <h1>Board</h1>
    </AppShell>,
  );

  expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
    "href",
    "#main-content",
  );
  expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
});

test("renders every primary destination", () => {
  render(
    <AppShell>
      <h1>Board</h1>
    </AppShell>,
  );

  const nav = screen.getByRole("navigation", { name: "Primary" });

  for (const label of ["Wanted Board", "Hunt", "Archive", "Notifications", "Profile"]) {
    expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
  }

  expect(nav).toContainElement(screen.getByRole("link", { name: "Wanted Board" }));
});

test("marks only the current destination for assistive technology", () => {
  render(
    <AppShell currentNavId="archive">
      <h1>Archive</h1>
    </AppShell>,
  );

  expect(screen.getByRole("link", { name: "Archive" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Wanted Board" })).not.toHaveAttribute("aria-current");
});

test("renders page content inside the main landmark", () => {
  render(
    <AppShell>
      <h1>Board</h1>
    </AppShell>,
  );

  expect(screen.getByRole("main")).toContainElement(screen.getByRole("heading", { name: "Board" }));
});

test("keeps the skip link as the first focusable element", () => {
  const { container } = render(
    <AppShell>
      <h1>Board</h1>
    </AppShell>,
  );

  const focusable = container.querySelectorAll("a, button, input, select, textarea");

  expect(focusable[0]).toHaveAttribute("href", "#main-content");
});

test("shows no console destination for an ordinary viewer", () => {
  render(
    <AppShell>
      <h1>Board</h1>
    </AppShell>,
  );

  expect(screen.queryByRole("link", { name: "Sheriff Console" })).not.toBeInTheDocument();
});

test("adds role destinations supplied by the view model", () => {
  render(
    <AppShell roleNav={[SHERIFF_CONSOLE_NAV]}>
      <h1>Board</h1>
    </AppShell>,
  );

  const nav = screen.getByRole("navigation", { name: "Primary" });
  const console = screen.getByRole("link", { name: "Sheriff Console" });

  expect(nav).toContainElement(console);
  expect(console).toHaveAttribute("href", "/console");
});

test("keeps the primary destinations when role destinations are added", () => {
  render(
    <AppShell roleNav={[SHERIFF_CONSOLE_NAV]}>
      <h1>Board</h1>
    </AppShell>,
  );

  for (const label of ["Wanted Board", "Hunt", "Archive", "Notifications", "Profile"]) {
    expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
  }
});

test("marks a role destination as current when it is the active page", () => {
  render(
    <AppShell currentNavId="console" roleNav={[SHERIFF_CONSOLE_NAV]}>
      <h1>Console</h1>
    </AppShell>,
  );

  expect(screen.getByRole("link", { name: "Sheriff Console" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
