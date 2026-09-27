import { render, screen, within } from "@testing-library/react";
import { HomeHunters } from "./home-hunters";
import { aHuntersPage } from "@/features/presentation/test-support/hunters";

test("shows the sampled Hunters as posters and the way to the whole wall", () => {
  render(<HomeHunters hunters={{ ok: true, data: aHuntersPage(1, 10, 6).items }} />);

  const list = screen.getByRole("list", { name: "Some Hunters" });
  expect(within(list).getAllByRole("link", { name: /^View profile of / })).toHaveLength(6);
  expect(screen.getByRole("link", { name: "See all Hunters" })).toHaveAttribute(
    "href",
    "/board?view=hunters",
  );
});

test("lays the posters flat, without the wall's overlap or motion", () => {
  const { container } = render(
    <HomeHunters hunters={{ ok: true, data: aHuntersPage(1, 10, 6).items }} />,
  );

  const slots = container.querySelectorAll("li");
  slots.forEach((slot) => expect(slot.getAttribute("style")).toBeNull());
  expect(container.querySelectorAll(".missing-poster--flat")).toHaveLength(6);
});

test.each(["AUTH_REQUIRED", "EMAIL_NOT_VERIFIED"] as const)(
  "leaves the %s action to Featured Wanted above, rather than repeating the link",
  (code) => {
    render(<HomeHunters hunters={{ ok: false, code, message: "" }} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  },
);

test.each([
  ["AUTH_REQUIRED", "Sign in to see the Hunters"],
  ["EMAIL_NOT_VERIFIED", "Verify your email to see the Hunters"],
  ["PROFILE_UNAVAILABLE", "The Hunters could not be loaded"],
] as const)("explains a %s refusal in place of the posters", (code, heading) => {
  render(<HomeHunters hunters={{ ok: false, code, message: "server wording" }} />);

  expect(screen.getByText(heading)).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Some Hunters" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "See all Hunters" })).not.toBeInTheDocument();
});
