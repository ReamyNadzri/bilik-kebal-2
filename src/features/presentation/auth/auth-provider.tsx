"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AccountViewModel, IdentityOperationCode, SignInResult } from "@/contracts";
import { callOperation, readOperation } from "@/features/presentation/call-operation";
import { IDENTITY_MESSAGE } from "@/features/presentation/identity-messages";
import {
  authStateFor,
  can as canDo,
  hasConsoleAccess as consoleAccess,
  type AccountCapability,
  type AuthState,
} from "./auth-state";
import { isGuestPath, signInPathFor } from "./redirect-target";
import { onSessionExpired } from "./session-expiry";

export interface AuthContextValue {
  readonly state: AuthState;
  /** Whether the account holds a published capability. */
  readonly can: (capability: AccountCapability) => boolean;
  readonly hasConsoleAccess: boolean;
  readonly signIn: (credentials: { email: string; password: string }) => Promise<SignInResult>;
  readonly signOut: () => Promise<void>;
  readonly refreshAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  readonly children: ReactNode;
  /**
   * The account the server already resolved for this request.
   *
   * Supplying it is what keeps `status` out of `loading` on first paint. A
   * screen that had to wait for a browser round trip before it knew who was
   * asking would either flash content it then withdraws, or show a spinner on
   * every navigation for information the server held all along.
   */
  readonly initialAccount: AccountViewModel | null;
}

export function AuthProvider({ children, initialAccount }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [state, setState] = useState<AuthState>(() => authStateFor(initialAccount));

  /**
   * Guards against handling one lost session several times.
   *
   * A screen usually has more than one operation in flight, and when the
   * session ends they are all refused in the same tick — before React has
   * re-rendered, so the status has not caught up yet. Without a marker set
   * synchronously as the first refusal is handled, each one would push its own
   * redirect and the viewer would land on the sign-in screen with a history
   * stack full of it.
   */
  const expiryHandledRef = useRef(false);

  /**
   * Adopts a server render that resolved a different account — after a
   * `router.refresh()`, or a navigation that crossed a verification decision.
   *
   * Adjusted during render rather than in an effect so no screen ever paints
   * against an account the server has already superseded. The server's answer
   * wins: it is the one the operations behind these screens will agree with.
   */
  const [seededAccount, setSeededAccount] = useState(initialAccount);
  if (seededAccount !== initialAccount) {
    setSeededAccount(initialAccount);
    setState(authStateFor(initialAccount));
  }

  const refreshAccount = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: null }));

    const result = await readOperation<AccountViewModel, "AUTH_REQUIRED" | "AUTH_UNAVAILABLE">(
      "/api/identity/account",
      "AUTH_UNAVAILABLE",
    );

    if (result.ok) {
      setState(authStateFor(result.data));
      return;
    }

    /**
     * A refused read is not automatically a lost session. `AUTH_REQUIRED`
     * means there is no account to show; anything else means identity could
     * not answer, and forgetting the account over a transient outage would
     * sign the viewer out of a session that is still valid.
     */
    setState((current) =>
      result.code === "AUTH_REQUIRED"
        ? { account: null, status: "unauthenticated", error: null }
        : {
            ...current,
            status: current.account === null ? "unauthenticated" : "authenticated",
            error: result.message === "" ? IDENTITY_MESSAGE.AUTH_UNAVAILABLE : result.message,
          },
    );
  }, []);

  /**
   * Reacts to an operation that was refused because the session ended.
   *
   * Three things stop this becoming a redirect loop: it only fires for an
   * account that was signed in a moment ago, it never fires on the screens
   * that exist to sign someone in, and the sign-in URL it builds refuses to
   * carry a guest path forward.
   */
  useEffect(() => {
    /**
     * A fresh session may expire in its turn, so the marker is cleared
     * whenever one is established.
     */
    if (state.status === "authenticated") {
      expiryHandledRef.current = false;
    }

    return onSessionExpired(() => {
      if (state.status !== "authenticated" || expiryHandledRef.current) {
        return;
      }

      expiryHandledRef.current = true;

      setState({
        account: null,
        status: "unauthenticated",
        error: "Your session ended, so you were signed out. Sign in again to continue.",
      });

      if (!isGuestPath(pathname)) {
        router.replace(`${signInPathFor(pathname)}${withExpiredFlag(pathname)}`);
      }
    });
  }, [pathname, router, state.status]);

  const signIn = useCallback(
    async (credentials: { email: string; password: string }): Promise<SignInResult> => {
      setState((current) => ({ ...current, status: "loading", error: null }));

      const result = (await callOperation<{ next: "profile" }, IdentityOperationCode>(
        "/api/auth/sign-in",
        credentials,
        "AUTH_UNAVAILABLE",
      )) as SignInResult;

      if (!result.ok) {
        setState({
          account: null,
          status: "unauthenticated",
          error: result.message === "" ? IDENTITY_MESSAGE[result.code] : result.message,
        });
        return result;
      }

      await refreshAccount();
      return result;
    },
    [refreshAccount],
  );

  const signOut = useCallback(async () => {
    const result = await callOperation<{ signedOut: true }, "AUTH_UNAVAILABLE">(
      "/api/auth/sign-out",
      {},
      "AUTH_UNAVAILABLE",
    );

    /**
     * A refused sign-out leaves the session standing, so the account stays on
     * screen and the viewer is told. Clearing it here would show a signed-out
     * shell over a session that is still live on the server — the one
     * misreading of this screen with a real cost.
     */
    if (!result.ok) {
      setState((current) => ({
        ...current,
        error:
          result.message === ""
            ? "You could not be signed out. Try again shortly."
            : result.message,
      }));
      return;
    }

    setState({ account: null, status: "unauthenticated", error: null });
    router.replace("/");
    router.refresh();
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      can: (capability: AccountCapability) => canDo(state, capability),
      hasConsoleAccess: consoleAccess(state),
      signIn,
      signOut,
      refreshAccount,
    }),
    [state, signIn, signOut, refreshAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (value === null) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return value;
}

/**
 * Survives a full page load, which React state does not.
 *
 * The provider's own `error` covers a client-side redirect; this covers the
 * case where the browser reloads and the explanation would otherwise be lost.
 */
function withExpiredFlag(pathname: string): string {
  return signInPathFor(pathname).includes("?") ? "&expired=1" : "?expired=1";
}
