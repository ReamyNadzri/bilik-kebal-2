import { activeNavId } from "./navigation";

test("marks the Board for the Board itself", () => {
  expect(activeNavId("/board")).toBe("board");
});

test("keeps the Board current while reading one of its Wanteds", () => {
  expect(activeNavId("/wanted/csc510-final-exam-notes")).toBe("board");
});

test("marks Hunt for the claims section", () => {
  expect(activeNavId("/claims")).toBe("claims");
});

test("marks the post action for its own page rather than the Board", () => {
  expect(activeNavId("/wanted/new")).toBe("post");
});

test("marks profile for a nested profile route", () => {
  expect(activeNavId("/profile/institution-verification")).toBe("profile");
});

test("marks the console for a Sheriff route", () => {
  expect(activeNavId("/console")).toBe("console");
});

test("marks nothing on the homepage, which is not a destination in the navigation", () => {
  expect(activeNavId("/")).toBeNull();
});

test("marks nothing for a route outside the navigation", () => {
  expect(activeNavId("/sign-in")).toBeNull();
});
