import { render, screen, waitFor } from "@testing-library/react";
import { ConsoleDashboard } from "./console-dashboard";

afterEach(() => vi.unstubAllGlobals());

test("counts each queue from its own operation and links to it", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string) => {
      const bodies: Record<string, unknown> = {
        "/api/claims/reviews": { ok: true, data: [{}, {}] },
        "/api/sheriff/moderation": { ok: true, data: { appeals: [{}] } },
        "/api/sheriff/payouts": {
          ok: true,
          data: [{ status: "pending" }, { status: "completed" }],
        },
        "/api/sheriff/refunds": { ok: false, code: "NOT_AUTHORIZED" },
      };
      return Promise.resolve({
        ok: path !== "/api/sheriff/refunds",
        json: async () => bodies[path],
      } as Response);
    }),
  );

  render(<ConsoleDashboard verificationCount={3} />);

  const claims = screen.getByRole("link", { name: /Claims to review/ });
  await waitFor(() => expect(claims).toHaveTextContent("2"));
  expect(claims).toHaveAttribute("href", "/console/claims");
  expect(screen.getByRole("link", { name: /Institution verifications/ })).toHaveTextContent("3");
  expect(screen.getByRole("link", { name: /Appeals/ })).toHaveTextContent("1");
  expect(screen.getByRole("link", { name: /Payouts to record/ })).toHaveTextContent("1");
  expect(screen.getByRole("link", { name: /Refunds to record/ })).toHaveTextContent(
    "Not available to your role",
  );
});
