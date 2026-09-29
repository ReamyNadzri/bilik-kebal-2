import {
  CLERK_UNAVAILABLE_MESSAGE,
  clerkErrorField,
  clerkMessage,
  toClerkError,
} from "./clerk-messages";

test("a wrong password and an unknown address read the same", () => {
  expect(clerkMessage({ code: "form_password_incorrect" })).toBe(
    clerkMessage({ code: "form_identifier_not_found" }),
  );
});

test("falls back to Clerk's long message, then its message, then unavailable", () => {
  expect(clerkMessage({ code: "x", longMessage: "Long.", message: "Short." })).toBe("Long.");
  expect(clerkMessage({ code: "x", message: "Short." })).toBe("Short.");
  expect(clerkMessage({ code: "x" })).toBe(CLERK_UNAVAILABLE_MESSAGE);
  expect(clerkMessage(null)).toBe(CLERK_UNAVAILABLE_MESSAGE);
});

test.each([
  ["form_code_incorrect", "code"],
  ["verification_expired", "code"],
  ["form_identifier_exists", "email"],
  ["form_password_pwned", "password"],
  ["too_many_requests", null],
] as const)("puts %s on the %s field", (code, field) => {
  expect(clerkErrorField({ code })).toBe(field);
});

test("unwraps the specific code Clerk nests in errors[0], camelCase or snake_case", () => {
  expect(
    toClerkError({
      code: "api_response_error",
      errors: [{ code: "form_code_incorrect", long_message: "L" }],
    }),
  ).toEqual({ code: "form_code_incorrect", longMessage: "L" });
  expect(clerkMessage({ errors: [{ code: "form_identifier_not_found" }] })).toBe(
    "The email address or password is not correct.",
  );
});

test("treats anything that is not a Clerk error as unavailable, never shown raw", () => {
  expect(toClerkError(new TypeError("boom"))).toBeNull();
  expect(clerkMessage(new TypeError("boom"))).toBe(CLERK_UNAVAILABLE_MESSAGE);
  expect(clerkErrorField("nope")).toBeNull();
});
