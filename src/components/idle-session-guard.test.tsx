import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { IdleSessionGuard } from "./idle-session-guard";
import { LAST_ACTIVITY_KEY } from "@/lib/idle-policy";

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});
afterEach(() => vi.useRealTimers());

test("warns a Sheriff 2 minutes before the 30-minute limit and keeps the session on request", () => {
  const onExpire = vi.fn();
  render(<IdleSessionGuard staff onExpire={onExpire} />);

  act(() => void vi.advanceTimersByTime(28 * 60_000 + 15_000));
  expect(screen.getByRole("alertdialog", { name: "Are you still there?" })).toBeInTheDocument();

  // The warning stays until the person answers it.
  act(() => void vi.advanceTimersByTime(30_000));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
  act(() => void vi.advanceTimersByTime(15_000));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(onExpire).not.toHaveBeenCalled();
});

test("signs a Sheriff out after 30 idle minutes, once", () => {
  const onExpire = vi.fn();
  render(<IdleSessionGuard staff onExpire={onExpire} />);
  act(() => void vi.advanceTimersByTime(31 * 60_000));
  act(() => void vi.advanceTimersByTime(60_000));
  expect(onExpire).toHaveBeenCalledTimes(1);
});

test("counts activity from another tab", () => {
  const onExpire = vi.fn();
  render(<IdleSessionGuard staff onExpire={onExpire} />);
  act(() => void vi.advanceTimersByTime(20 * 60_000));
  window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  act(() => void vi.advanceTimersByTime(15 * 60_000));
  expect(onExpire).not.toHaveBeenCalled();
});

test("leaves a member signed in far past 30 minutes", () => {
  const onExpire = vi.fn();
  render(<IdleSessionGuard staff={false} onExpire={onExpire} />);
  act(() => void vi.advanceTimersByTime(6 * 60 * 60_000));
  expect(onExpire).not.toHaveBeenCalled();
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});
