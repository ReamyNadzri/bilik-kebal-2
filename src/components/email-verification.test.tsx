import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { EmailVerification } from "./email-verification";

const ADDRESS = "student@example.edu.my";

function queueFetch(...payloads: unknown[]) {
  const mock = vi.fn();

  for (const payload of payloads) {
    mock.mockResolvedValueOnce({ ok: true, json: async () => payload });
  }

  vi.stubGlobal("fetch", mock);
  return mock;
}

function resend() {
  fireEvent.click(screen.getByRole("button", { name: "Resend the link" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("tells a waiting user where the link was sent", () => {
  render(<EmailVerification status="pending" address={ADDRESS} />);

  expect(screen.getByText(new RegExp(ADDRESS))).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Resend the link" })).toBeInTheDocument();
});

test("confirms success without overstating what it grants", () => {
  render(<EmailVerification status="verified" address={ADDRESS} />);

  expect(screen.getByText("Email Verified")).toBeInTheDocument();
  expect(screen.getByText(/institution verification/i)).toHaveTextContent(
    /funding a bounty, submitting a claim and downloading/i,
  );
});

test("does not claim institution verification after an email is verified", () => {
  render(<EmailVerification status="verified" address={ADDRESS} />);

  expect(screen.queryByText("Institution Verified")).not.toBeInTheDocument();
  expect(screen.queryByTestId("star-emblem")).not.toBeInTheDocument();
});

test("offers a new link when the old one expired", () => {
  render(<EmailVerification status="expired" address={ADDRESS} />);

  expect(screen.getByText(/has expired/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Resend the link" })).toBeInTheDocument();
});

test("announces an unusable link as a failure", () => {
  const alert = (() => {
    render(<EmailVerification status="invalid" address={ADDRESS} />);
    return screen.getByRole("alert");
  })();

  expect(alert).toHaveTextContent("Error");
  expect(alert).toHaveTextContent(/could not be used/i);
});

test("does not offer a resend once the address is verified", () => {
  render(<EmailVerification status="verified" address={ADDRESS} />);

  expect(screen.queryByRole("button", { name: "Resend the link" })).not.toBeInTheDocument();
});

/**
 * The resend operation reads the address from a signed, HTTP-only cookie, so
 * without that cookie there is nothing for it to send to. Offering a button
 * that cannot work would waste the attempt and leave the reason unexplained.
 */
test("withholds the resend when no address is pending in this browser", () => {
  render(<EmailVerification status="pending" address={null} />);

  expect(screen.queryByRole("button", { name: "Resend the link" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute(
    "href",
    "/sign-up",
  );
});

test("sends the resend request with no browser-chosen recipient", async () => {
  const fetchMock = queueFetch({ ok: true, data: { accepted: true } });

  render(<EmailVerification status="pending" address={ADDRESS} />);
  resend();

  await screen.findByText(/on its way/i);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/auth/resend-verification");
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({});
});

/**
 * A live region that repeats the sentence already on screen is read twice.
 */
test("announces the resend in wording that differs from the visible text", async () => {
  queueFetch({ ok: true, data: { accepted: true } });

  render(<EmailVerification status="pending" address={ADDRESS} />);
  resend();

  const announcer = await screen.findByTestId("resend-announcer");

  await waitFor(() => {
    expect(announcer).toHaveTextContent(/sent/i);
  });
  expect(announcer).toHaveAttribute("aria-live", "polite");

  const visible = screen.getByText(/on its way/i).textContent ?? "";
  expect(announcer.textContent).not.toBe(visible);
});

test("reports a rate-limited resend as something to wait out", async () => {
  queueFetch({
    ok: false,
    code: "AUTH_RATE_LIMITED",
    message: "Too many attempts. Wait and try again.",
  });

  render(<EmailVerification status="pending" address={ADDRESS} />);
  resend();

  expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
});

test("reports an unavailable resend without blaming the address", async () => {
  queueFetch({
    ok: false,
    code: "AUTH_UNAVAILABLE",
    message: "Verification email could not be resent. Try again.",
  });

  render(<EmailVerification status="pending" address={ADDRESS} />);
  resend();

  expect(await screen.findByText(/could not be resent/i)).toBeInTheDocument();
});

/**
 * aria-disabled does not block a click or an Enter key, and several
 * activations can arrive before React re-renders, so the handler refuses the
 * repeat itself.
 */
test("guards the handler rather than relying on aria-disabled to block activation", async () => {
  const fetchMock = queueFetch({ ok: true, data: { accepted: true } });

  render(<EmailVerification status="pending" address={ADDRESS} />);

  const button = screen.getByRole("button", { name: "Resend the link" });
  fireEvent.click(button);
  fireEvent.click(button);
  fireEvent.click(button);

  await screen.findByText(/on its way/i);

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("keeps the resend control mounted and focused while it runs", async () => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const mock = vi.fn().mockImplementationOnce(async () => {
    await held;
    return { ok: true, json: async () => ({ ok: true, data: { accepted: true } }) };
  });
  vi.stubGlobal("fetch", mock);

  render(<EmailVerification status="pending" address={ADDRESS} />);

  const button = screen.getByRole("button", { name: "Resend the link" });
  button.focus();
  fireEvent.click(button);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Resend the link" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  const inFlight = screen.getByRole("button", { name: "Resend the link" });
  expect(inFlight).not.toBeDisabled();
  expect(document.activeElement).toBe(inFlight);

  release();
  await screen.findByText(/on its way/i);
});

test("shows a waiting state while the resend is in flight", async () => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const mock = vi.fn().mockImplementationOnce(async () => {
    await held;
    return { ok: true, json: async () => ({ ok: true, data: { accepted: true } }) };
  });
  vi.stubGlobal("fetch", mock);

  render(<EmailVerification status="pending" address={ADDRESS} />);
  resend();

  expect(await screen.findByText("Sending a new link")).toBeInTheDocument();

  release();
  await screen.findByText(/on its way/i);
});

test("never queues more than one interrupting announcement", async () => {
  queueFetch({
    ok: false,
    code: "AUTH_UNAVAILABLE",
    message: "Verification email could not be resent. Try again.",
  });

  render(<EmailVerification status="invalid" address={ADDRESS} />);

  expect(screen.getAllByRole("alert")).toHaveLength(1);
});
