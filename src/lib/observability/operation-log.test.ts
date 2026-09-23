import { beginOperation } from "./operation-log";

test("logs only allowlisted operational fields and uses a unique correlation ID", () => {
  const sink = vi.fn();
  const trace = beginOperation("notifications.list", sink);
  trace.finish(503);
  expect(JSON.parse(sink.mock.calls[0]![0])).toEqual({
    correlationId: trace.correlationId,
    operation: "notifications.list",
    status: 503,
    outcome: "unavailable",
    durationMs: expect.any(Number),
  });
  expect(beginOperation("notifications.read", sink).correlationId).not.toBe(trace.correlationId);
});

test("an unavailable log sink does not break the operation", () => {
  expect(() =>
    beginOperation("notifications.read", () => {
      throw new Error("unavailable");
    }).finish(200),
  ).not.toThrow();
});
