import { fireEvent, render, screen, within } from "@testing-library/react";
import ExploreMapPage from "./page";
import type { CampusRegion } from "@/contracts/marketplace";
import { anAccountViewModel } from "@/features/presentation/test-support/account-view-model";

const listCampusRegions = vi.fn();
const readAccount = vi.fn();
vi.mock("@/modules/wanted/loaders/wanted-operations", () => ({
  listCampusRegions: () => listCampusRegions(),
}));
vi.mock("@/features/presentation/auth/require-account", () => ({
  readAccount: () => readAccount(),
}));

function region(overrides: Partial<CampusRegion>): CampusRegion {
  return {
    id: "c",
    name: "Campus",
    regionOpen: true,
    latitude: null,
    longitude: null,
    mapX: 10,
    mapY: 10,
    openWantedCount: 0,
    openBountySen: 0 as CampusRegion["openBountySen"],
    ...overrides,
  };
}

const REGIONS: CampusRegion[] = [
  region({
    id: "shah-alam",
    name: "UiTM Shah Alam",
    openWantedCount: 4,
    openBountySen: 7800 as CampusRegion["openBountySen"],
  }),
  region({ id: "dungun", name: "UiTM Dungun", openWantedCount: 1 }),
  region({ id: "arau", name: "UiTM Arau", regionOpen: false }),
  region({ id: "no-pin", name: "UiTM Unmapped", regionOpen: false, mapX: null, mapY: null }),
];

async function renderPage() {
  render(await ExploreMapPage());
}

beforeEach(() => {
  listCampusRegions.mockResolvedValue({ ok: true, data: REGIONS });
  readAccount.mockResolvedValue({
    kind: "account",
    account: anAccountViewModel({
      trust: { email: "verified", institution: "verified", restricted: false },
    }),
  });
});

test("no longer presents the map as development fixture data", async () => {
  await renderPage();

  expect(screen.queryByText("Development only")).toBeNull();
  expect(
    screen.getByRole("heading", { level: 1, name: "Where is knowledge needed?" }),
  ).toBeInTheDocument();
});

test("opens on the first open campus with its live totals", async () => {
  await renderPage();

  expect(screen.getByRole("heading", { level: 2, name: "UiTM Shah Alam" })).toBeInTheDocument();
  expect(screen.getByText("RM 78")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /View requests here/ })).toHaveAttribute(
    "href",
    "/board?campus=shah-alam",
  );
});

test("pins only campuses with a map position, and marks locked ones coming soon", async () => {
  await renderPage();

  expect(screen.getAllByRole("button", { name: /^Map pin:/ })).toHaveLength(3);
  expect(
    screen.getByRole("button", { name: "Map pin: UiTM Arau, coming soon" }),
  ).toBeInTheDocument();
});

test("a locked campus explains that it is not open yet and offers no requests link", async () => {
  await renderPage();

  fireEvent.click(screen.getByRole("button", { name: "Map pin: UiTM Arau, coming soon" }));

  expect(screen.getByText(/not open for requests yet/)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /View requests here/ })).toBeNull();
});

test("lists open campuses apart from those coming soon", async () => {
  await renderPage();

  const lists = screen.getAllByRole("list", { name: "Campuses" });
  expect(within(lists[0]!).getAllByRole("button")).toHaveLength(2);
  expect(within(lists[1]!).getAllByRole("button")).toHaveLength(2);
});

test("hides live counts from a visitor who is not signed in", async () => {
  readAccount.mockResolvedValue({ kind: "unauthenticated" });
  await renderPage();

  expect(screen.queryByText("RM 78")).toBeNull();
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in?next=/map",
  );
});

test("says so when the regions cannot be read", async () => {
  listCampusRegions.mockResolvedValue({ ok: false, code: "MARKETPLACE_UNAVAILABLE", message: "" });
  await renderPage();

  expect(screen.getByText("The campus map could not be loaded")).toBeInTheDocument();
});
