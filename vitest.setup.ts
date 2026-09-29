import "@testing-library/jest-dom/vitest";

vi.mock("@clerk/nextjs", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useSignIn: () => ({
      signIn: null,
      errors: null,
      fetchStatus: "idle",
    }),
    useSignUp: () => ({
      signUp: null,
      errors: null,
      fetchStatus: "idle",
    }),
    useUser: () => ({
      user: null,
      isSignedIn: false,
      isLoaded: true,
    }),
    useClerk: () => ({
      signOut: vi.fn(),
    }),
  };
});
