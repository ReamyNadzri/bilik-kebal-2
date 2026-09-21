import {
  DEFAULT_SIGNED_IN_PATH,
  isGuestPath,
  readNextPath,
  signInPathFor,
  SIGN_IN_PATH,
} from "./redirect-target";

describe("readNextPath", () => {
  test("keeps a same-origin path with its query", () => {
    expect(readNextPath("/wanted/csc510-final-exam-notes?tab=bounty")).toBe(
      "/wanted/csc510-final-exam-notes?tab=bounty",
    );
  });

  /**
   * An open redirect on a sign-in screen is a credential phishing route: the
   * victim signs in on the real site and is then handed to the attacker's.
   */
  test("refuses an absolute URL to another origin", () => {
    expect(readNextPath("https://attacker.example/steal")).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  test("refuses a protocol-relative URL", () => {
    expect(readNextPath("//attacker.example")).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  test("falls back when the parameter is absent", () => {
    expect(readNextPath(undefined)).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(readNextPath(null)).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  /** A repeated query parameter arrives as an array; the first one wins. */
  test("reads the first value of a repeated parameter", () => {
    expect(readNextPath(["/profile", "/console"])).toBe("/profile");
  });

  test("accepts an explicit fallback", () => {
    expect(readNextPath(undefined, "/board")).toBe("/board");
  });
});

describe("isGuestPath", () => {
  test("recognises the screens that exist to sign someone in", () => {
    for (const path of ["/sign-in", "/sign-up", "/recover", "/verify-email"]) {
      expect(isGuestPath(path)).toBe(true);
    }
  });

  test("does not treat a protected screen as a guest one", () => {
    for (const path of ["/profile", "/console", "/board", "/"]) {
      expect(isGuestPath(path)).toBe(false);
    }
  });

  /**
   * Prefix matching must not catch a route that merely starts with the same
   * letters, or a future `/sign-in-history` screen would silently stop being
   * protected.
   */
  test("matches whole segments rather than string prefixes", () => {
    expect(isGuestPath("/sign-in-history")).toBe(false);
    expect(isGuestPath("/sign-in/step-two")).toBe(true);
  });
});

describe("signInPathFor", () => {
  test("carries the viewer's destination forward", () => {
    expect(signInPathFor("/profile")).toBe("/sign-in?next=%2Fprofile");
  });

  /**
   * Loop prevention. Returning someone to the sign-in screen they just
   * completed would bounce them straight back to it.
   */
  test("never returns a guest screen to itself", () => {
    expect(signInPathFor("/sign-in")).toBe(SIGN_IN_PATH);
    expect(signInPathFor("/sign-up")).toBe(SIGN_IN_PATH);
  });

  test("drops a destination that leaves this origin", () => {
    expect(signInPathFor("https://attacker.example")).toBe(SIGN_IN_PATH);
    expect(signInPathFor("//attacker.example")).toBe(SIGN_IN_PATH);
  });

  test("drops an empty destination", () => {
    expect(signInPathFor("")).toBe(SIGN_IN_PATH);
  });

  test("round-trips through readNextPath", () => {
    const url = new URL(signInPathFor("/wanted/abc?tab=bounty"), "https://vaultix.invalid");

    expect(readNextPath(url.searchParams.get("next"))).toBe("/wanted/abc?tab=bounty");
  });
});
