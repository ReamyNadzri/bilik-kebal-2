/**
 * What the `@clerk/nextjs` hooks return in tests (vitest.setup.ts reads this).
 *
 * Tests assign the fakes they need; `resetClerkHooks` runs before every test.
 * Production code never imports this module.
 */
export const clerkHooks: {
  signIn: unknown;
  signUp: unknown;
  session: unknown;
  user: unknown;
  signOut: (...args: unknown[]) => Promise<void>;
} = {
  signIn: null,
  signUp: null,
  session: null,
  user: null,
  signOut: async () => undefined,
};

export function resetClerkHooks() {
  clerkHooks.signIn = null;
  clerkHooks.signUp = null;
  clerkHooks.session = null;
  clerkHooks.user = null;
  clerkHooks.signOut = async () => undefined;
}

/** A Clerk method result: `{ error: null }` or a Clerk-shaped error. */
export function clerkResult(error?: { code: string; message?: string; longMessage?: string }) {
  return {
    error: error
      ? { code: error.code, message: error.message ?? error.code, longMessage: error.longMessage }
      : null,
  };
}
