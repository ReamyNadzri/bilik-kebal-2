import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TERMS_OF_USE_VERSION } from "@/contracts/legal";
import { rememberTermsAgreement } from "@/features/legal/pending-agreement";
import { TermsGate } from "./terms-gate";

const refresh = vi.fn();
let pathname = "/board";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => pathname,
}));

const fetchMock = vi.fn();

function answer(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok: status < 400,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  });
}

beforeEach(() => {
  pathname = "/board";
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

const page = <p>The Board</p>;

test("shows the page when nothing needs accepting", () => {
  render(<TermsGate required={false}>{page}</TermsGate>);
  expect(screen.getByText("The Board")).toBeInTheDocument();
});

test("shows the acceptance screen instead of the page until the member agrees", () => {
  render(<TermsGate required>{page}</TermsGate>);
  expect(screen.queryByText("The Board")).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 1, name: "Before you continue" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
  expect(screen.getByRole("link", { name: "Baca dalam Bahasa Melayu" })).toHaveAttribute(
    "href",
    "/privacy?lang=ms",
  );
  expect(screen.getByRole("link", { name: "Sign out" })).toHaveAttribute("href", "/sign-out");
});

test.each(["/terms", "/privacy", "/refunds", "/sign-out"])(
  "leaves %s readable before agreeing",
  (path) => {
    pathname = path;
    render(<TermsGate required>{page}</TermsGate>);
    expect(screen.getByText("The Board")).toBeInTheDocument();
  },
);

test("needs the box ticked, then records the agreement and reloads the page", async () => {
  answer({ ok: true, data: { outcome: "accepted" } });
  render(<TermsGate required>{page}</TermsGate>);

  fireEvent.click(screen.getByRole("button", { name: "Agree and continue" }));
  expect(await screen.findAllByText(/confirm you are 18 or older/)).not.toHaveLength(0);
  expect(fetchMock).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("checkbox", { name: /18 or older/ }));
  fireEvent.click(screen.getByRole("button", { name: "Agree and continue" }));

  await waitFor(() => expect(refresh).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/legal/terms-acceptance");
  expect(JSON.parse(String(init.body))).toEqual({
    version: TERMS_OF_USE_VERSION,
    confirmedAdult: true,
  });
});

test("records the box ticked at sign-up without asking again", async () => {
  rememberTermsAgreement();
  answer({ ok: true, data: { outcome: "accepted" } });
  render(<TermsGate required>{page}</TermsGate>);

  await waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(window.sessionStorage.getItem("vaultix.termsAgreement")).toBeNull();
});

test("offers a reload when the Terms changed while the page was open", async () => {
  answer(
    {
      ok: false,
      code: "TERMS_VERSION_STALE",
      message:
        "The Terms changed while this page was open. Reload the page to read the new version.",
    },
    409,
  );
  render(<TermsGate required>{page}</TermsGate>);

  fireEvent.click(screen.getByRole("checkbox", { name: /18 or older/ }));
  fireEvent.click(screen.getByRole("button", { name: "Agree and continue" }));

  expect(await screen.findByText(/The Terms changed/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  expect(refresh).toHaveBeenCalled();
});
