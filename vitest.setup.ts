import "@testing-library/jest-dom/vitest";
import { clerkHooks, resetClerkHooks } from "@/features/presentation/test-support/clerk-hooks";

vi.mock("@clerk/nextjs", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { clerkHooks: hooks } = await import("@/features/presentation/test-support/clerk-hooks");
  return {
    ...actual,
    useSignIn: () => ({ signIn: hooks.signIn, errors: null, fetchStatus: "idle" }),
    useSignUp: () => ({ signUp: hooks.signUp, errors: null, fetchStatus: "idle" }),
    useSession: () => ({
      session: hooks.session,
      isSignedIn: hooks.session !== null,
      isLoaded: true,
    }),
    useUser: () => ({ user: hooks.user, isSignedIn: hooks.user !== null, isLoaded: true }),
    useClerk: () => ({ signOut: (...args: unknown[]) => hooks.signOut(...args) }),
  };
});

beforeEach(() => resetClerkHooks());

export { clerkHooks };
