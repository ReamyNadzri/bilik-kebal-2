import { render, screen } from "@testing-library/react";
import { ProfileWantedGrid } from "./profile-wanted-grid";

test("labels the section by its own heading id so two grids can share a page", () => {
  render(
    <>
      <ProfileWantedGrid
        heading="Your requests"
        wanted={[]}
        now="2026-10-03T00:00:00Z"
        empty="none"
      />
      <ProfileWantedGrid
        heading="Wanteds you backed"
        headingId="profile-backed-heading"
        wanted={[]}
        now="2026-10-03T00:00:00Z"
        empty="none"
      />
    </>,
  );
  expect(screen.getByRole("region", { name: "Your requests" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Wanteds you backed" })).toBeInTheDocument();
  expect(document.getElementById("profile-grid-heading")).toHaveTextContent("Your requests");
  expect(document.getElementById("profile-backed-heading")).toHaveTextContent("Wanteds you backed");
});
