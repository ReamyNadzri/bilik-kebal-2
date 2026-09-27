import { describe, expect, it } from "vitest";
import { huntersHref, parseHuntersParams } from "./hunters-params";

function from(query: string) {
  const params = new URLSearchParams(query);
  return parseHuntersParams((name) => params.get(name));
}

describe("parseHuntersParams", () => {
  it("reads the page size and page", () => {
    expect(from("view=hunters&per=15&page=3")).toEqual({ per: 15, page: 3 });
  });

  it.each(["per=12", "per=abc", "per=", ""])("falls back to 10 per page for %s", (query) => {
    expect(from(query).per).toBe(10);
  });

  it.each(["page=0", "page=-2", "page=1.5", "page=x", "page=999999"])(
    "falls back to page 1 for %s",
    (query) => {
      expect(from(query).page).toBe(1);
    },
  );

  it("takes the first of repeated values", () => {
    expect(parseHuntersParams((name) => (name === "per" ? ["20", "10"] : undefined))).toEqual({
      per: 20,
      page: 1,
    });
  });
});

describe("huntersHref", () => {
  it("leaves the defaults out of the link", () => {
    expect(huntersHref({ per: 10, page: 1 })).toBe("/board?view=hunters");
    expect(huntersHref({ per: 20, page: 2 })).toBe("/board?view=hunters&per=20&page=2");
  });
});
