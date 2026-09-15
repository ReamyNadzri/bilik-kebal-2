import { formatClosing, formatPostedAge, formatSubmittedAge } from "./time";

const NOW = "2026-09-14T09:00:00.000Z";

describe("posted age", () => {
  test("reports minutes inside the first hour", () => {
    expect(formatPostedAge("2026-09-14T08:38:00.000Z", NOW)).toBe("Posted 22 minutes ago");
  });

  test("reports a single minute without pluralising", () => {
    expect(formatPostedAge("2026-09-14T08:59:00.000Z", NOW)).toBe("Posted 1 minute ago");
  });

  test("reports hours inside the first day", () => {
    expect(formatPostedAge("2026-09-14T07:00:00.000Z", NOW)).toBe("Posted 2 hours ago");
  });

  test("reports days beyond that", () => {
    expect(formatPostedAge("2026-09-11T09:00:00.000Z", NOW)).toBe("Posted 3 days ago");
  });

  test("treats anything under a minute as just now", () => {
    expect(formatPostedAge("2026-09-14T08:59:30.000Z", NOW)).toBe("Posted just now");
  });
});

describe("closing time", () => {
  test("reports hours when less than a day remains", () => {
    expect(formatClosing("2026-09-14T15:00:00.000Z", NOW)).toEqual({
      label: "Closes in 6 hours",
      urgent: true,
    });
  });

  test("reports a single hour without pluralising", () => {
    expect(formatClosing("2026-09-14T10:00:00.000Z", NOW)).toEqual({
      label: "Closes in 1 hour",
      urgent: true,
    });
  });

  test("reports minutes in the final hour", () => {
    expect(formatClosing("2026-09-14T09:45:00.000Z", NOW)).toEqual({
      label: "Closes in 45 minutes",
      urgent: true,
    });
  });

  test("reports days beyond one, and is not urgent", () => {
    expect(formatClosing("2026-09-18T09:00:00.000Z", NOW)).toEqual({
      label: "Closes in 4 days",
      urgent: false,
    });
  });

  test("marks the last full day as urgent", () => {
    expect(formatClosing("2026-09-15T08:00:00.000Z", NOW)).toEqual({
      label: "Closes in 23 hours",
      urgent: true,
    });
  });

  test("says a passed deadline is closed rather than counting backwards", () => {
    expect(formatClosing("2026-09-13T09:00:00.000Z", NOW)).toEqual({
      label: "Closed",
      urgent: false,
    });
  });
});

describe("detailed remaining time", () => {
  test("pairs days with hours for the detail page", () => {
    expect(formatClosing("2026-09-17T00:00:00.000Z", NOW, { detail: true })).toEqual({
      label: "2 days 15 hours left",
      urgent: false,
    });
  });

  test("drops the day part once under a day", () => {
    expect(formatClosing("2026-09-14T14:30:00.000Z", NOW, { detail: true })).toEqual({
      label: "5 hours 30 minutes left",
      urgent: true,
    });
  });
});

describe("submitted age", () => {
  test("describes when a claim was sent", () => {
    expect(formatSubmittedAge("2026-09-11T09:00:00.000Z", NOW)).toBe("Submitted 3 days ago");
  });

  test("reports a week as days so the reader can compare claims", () => {
    expect(formatSubmittedAge("2026-09-07T09:00:00.000Z", NOW)).toBe("Submitted 7 days ago");
  });
});
