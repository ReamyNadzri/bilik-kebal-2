import { failure, success } from "./operation-result";

test("creates a successful operation result", () => {
  expect(success({ id: "public_123" })).toEqual({
    ok: true,
    data: { id: "public_123" },
  });
});

test("creates a safe failure with field errors", () => {
  expect(failure("INVALID_INPUT", "Check the form.", { title: ["Required"] })).toEqual({
    ok: false,
    code: "INVALID_INPUT",
    message: "Check the form.",
    fieldErrors: { title: ["Required"] },
  });
});
