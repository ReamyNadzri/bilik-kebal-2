import { render, screen, within } from "@testing-library/react";
import { WantedCard } from "./wanted-card";
import { aWanted } from "@/features/marketplace/test-support/wanted";

const NOW = "2026-09-14T09:00:00.000Z";

function renderCard(overrides: Parameters<typeof aWanted>[0] = {}) {
  return render(<WantedCard wanted={aWanted(overrides)} now={NOW} />);
}

test("shows the request title", () => {
  renderCard({ title: "Final exam notes and summary for chapters 1 to 12" });

  expect(
    screen.getByRole("heading", { name: "Final exam notes and summary for chapters 1 to 12" }),
  ).toBeInTheDocument();
});

test("shows the course code and course name together", () => {
  renderCard({ courseCode: "CSC510", courseName: "Database Systems" });

  expect(screen.getByText("CSC510")).toBeInTheDocument();
  expect(screen.getByText("Database Systems")).toBeInTheDocument();
});

test("labels the campus, resource type and session rather than running them together", () => {
  renderCard({
    campus: "UiTM Shah Alam",
    resourceType: "Lecture notes",
    session: "Semester 2, 2024/2025",
  });

  const details = screen.getByRole("group", { name: /request details/i });

  expect(within(details).getByText("Campus")).toBeInTheDocument();
  expect(within(details).getByText("UiTM Shah Alam")).toBeInTheDocument();
  expect(within(details).getByText("Resource")).toBeInTheDocument();
  expect(within(details).getByText("Lecture notes")).toBeInTheDocument();
  expect(within(details).getByText("Session")).toBeInTheDocument();
  expect(within(details).getByText("Semester 2, 2024/2025")).toBeInTheDocument();
});

test("shows the gross bounty formatted in Ringgit", () => {
  renderCard({ grossBountySen: 8500 as never });

  expect(screen.getByText("Total bounty RM 85")).toBeInTheDocument();
});

test("shows the backer count", () => {
  renderCard({ backerCount: 6 });

  expect(screen.getByText("6 backers")).toBeInTheDocument();
});

test("does not pluralise a single backer", () => {
  renderCard({ backerCount: 1 });

  expect(screen.getByText("1 backer")).toBeInTheDocument();
});

test("invites the first backer when there are none", () => {
  renderCard({ backerCount: 0 });

  expect(screen.getByText("No backers yet")).toBeInTheDocument();
});

test("shows how long is left while the request is open", () => {
  renderCard({ closesAt: "2026-09-17T00:00:00.000Z" });

  expect(screen.getByText("Closes in 2 days")).toBeInTheDocument();
});

test("shows how old a closed request is instead of a dead countdown", () => {
  renderCard({ status: "closed", closesAt: "2026-09-13T09:00:00.000Z" });

  expect(screen.getByText("Posted 3 days ago")).toBeInTheDocument();
  expect(screen.queryByText(/Closes in/)).not.toBeInTheDocument();
});

test("shows the lifecycle status as a word", () => {
  renderCard({ status: "ending-soon" });

  expect(screen.getByText("Ending soon")).toBeInTheDocument();
});

test("offers one clear action to the Wanted", () => {
  renderCard({ id: "csc510-final-exam-notes" });

  expect(screen.getByRole("link", { name: /View this Wanted/ })).toHaveAttribute(
    "href",
    "/wanted/csc510-final-exam-notes",
  );
});

test("names the action distinctly so a list of cards is navigable by link alone", () => {
  renderCard({ id: "csc510-final-exam-notes", title: "Final exam notes" });

  expect(
    screen.getByRole("link", { name: "View this Wanted: Final exam notes" }),
  ).toBeInTheDocument();
});

test("links the title to the same Wanted", () => {
  renderCard({ id: "csc510-final-exam-notes", title: "Final exam notes" });

  expect(screen.getByRole("link", { name: "Final exam notes" })).toHaveAttribute(
    "href",
    "/wanted/csc510-final-exam-notes",
  );
});

test("is a list item so a Board of cards announces its length", () => {
  const { container } = renderCard();

  expect(container.firstElementChild?.tagName).toBe("LI");
});

test("previews no resource, file, path or claim content", () => {
  const { container } = renderCard();
  const html = container.innerHTML;

  expect(html).not.toMatch(/download|preview|\.pdf|\.docx|object_key|objectKey|bucket/i);
});
