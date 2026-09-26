/**
 * A stand-in for React's server `cache` in unit tests.
 *
 * Test support only. Production code must never import this module.
 *
 * React memoises `cache` per server request, and not at all outside a server
 * render — which is where Vitest runs. This models one request as one memo
 * table, so a test can show that loaders share a read within a request and
 * repeat it for the next one. It keys on the function alone, which suits the
 * argument-free request loaders it stands in for.
 */
const memo = new Map<unknown, unknown>();

export function requestScopedCache<T extends (...args: never[]) => unknown>(fn: T): T {
  return ((...args: Parameters<T>) => {
    if (!memo.has(fn)) memo.set(fn, fn(...args));
    return memo.get(fn);
  }) as T;
}

/** Ends the simulated request: the next call to a cached loader reads again. */
export function startNewRequest(): void {
  memo.clear();
}
