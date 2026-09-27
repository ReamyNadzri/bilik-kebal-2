import type { HuntersPageSize, PublicHunter, PublicHuntersPage } from "@/contracts/profiles";

/**
 * Builders for the Hunters wall.
 *
 * Test support only. Production code must never import this module
 * (`context/code-standards.md`).
 */
export function aHunter(index: number, overrides: Partial<PublicHunter> = {}): PublicHunter {
  return {
    publicId: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
    displayName: `Hunter ${index}`,
    avatarUrl: index % 2 ? "/brand/avatar-3.webp" : null,
    institutionName: "UiTM Shah Alam",
    joinedAt: "2024-03-10T04:00:00.000Z",
    ...overrides,
  };
}

/** Page `page` of a wall of `total` Hunters, `pageSize` to a page. */
export function aHuntersPage(
  page = 1,
  pageSize: HuntersPageSize = 10,
  total = 24,
): PublicHuntersPage {
  const first = (page - 1) * pageSize + 1;
  const count = Math.max(0, Math.min(pageSize, total - first + 1));
  return {
    total,
    page,
    pageSize,
    items: Array.from({ length: count }, (_, offset) => aHunter(first + offset)),
  };
}
