import { formatRinggit, sen, toSen } from "./money";

test("formats whole Ringgit without a decimal tail", () => {
  expect(formatRinggit(sen(8500))).toBe("RM 85");
});

test("formats a part-Ringgit amount to two decimals", () => {
  expect(formatRinggit(sen(8550))).toBe("RM 85.50");
  expect(formatRinggit(sen(105))).toBe("RM 1.05");
});

test("formats the smallest contribution", () => {
  expect(formatRinggit(sen(100))).toBe("RM 1");
});

test("formats zero", () => {
  expect(formatRinggit(sen(0))).toBe("RM 0");
});

test("groups thousands", () => {
  expect(formatRinggit(sen(1234567))).toBe("RM 12,345.67");
});

test("separates the unit from the amount so it can be styled apart", () => {
  expect(formatRinggit(sen(4500), { unit: "omit" })).toBe("45");
  expect(formatRinggit(sen(4550), { unit: "omit" })).toBe("45.50");
});

test("rejects a non-integer amount rather than rounding money silently", () => {
  expect(() => sen(85.5)).toThrow(/integer/i);
});

test("rejects a negative amount", () => {
  expect(() => sen(-1)).toThrow(/negative/i);
});

test("converts whole Ringgit to sen for fixture authoring", () => {
  expect(toSen(85)).toBe(8500);
  expect(toSen(1)).toBe(100);
});
