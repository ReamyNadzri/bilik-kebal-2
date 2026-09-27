import { HUNTERS_PAGE_SIZES, type HuntersPageSize } from "@/contracts/profiles";

export interface HuntersParams {
  readonly per: HuntersPageSize;
  readonly page: number;
}

export const DEFAULT_HUNTERS_PARAMS: HuntersParams = { per: 10, page: 1 };

type Raw = string | string[] | null | undefined;

function first(value: Raw): string | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

/**
 * The Hunters wall's page size and page, from the Board's URL. A value the
 * wall does not offer falls back to the default instead of failing the page:
 * a mistyped link still opens the wall.
 */
export function parseHuntersParams(read: (name: string) => Raw): HuntersParams {
  const per = Number(first(read("per")));
  const page = Number(first(read("page")));
  return {
    per: (HUNTERS_PAGE_SIZES as readonly number[]).includes(per)
      ? (per as HuntersPageSize)
      : DEFAULT_HUNTERS_PARAMS.per,
    page: Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : 1,
  };
}

/** The Board URL for a page of the wall. The defaults are left out. */
export function huntersHref({ per, page }: HuntersParams): string {
  const query = new URLSearchParams({ view: "hunters" });
  if (per !== DEFAULT_HUNTERS_PARAMS.per) query.set("per", String(per));
  if (page !== 1) query.set("page", String(page));
  return `/board?${query.toString()}`;
}
