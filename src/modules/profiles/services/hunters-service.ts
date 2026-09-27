import { failure, success } from "@/contracts/operation-result";
import {
  listHuntersInputSchema,
  type HuntersPageSize,
  type ListHuntersResult,
  type PublicHunter,
  type SampleHuntersResult,
} from "@/contracts/profiles";
import type { ProfileActor } from "./profile-service";

export interface HuntersRepository {
  listPage(pageSize: number, page: number): Promise<{ total: number; items: PublicHunter[] }>;
}

/** The page the homepage samples from; the largest the database allows. */
const SAMPLE_POOL: HuntersPageSize = 20;

function refusal(error: unknown) {
  const text =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  return text.includes("EMAIL_NOT_VERIFIED")
    ? failure("EMAIL_NOT_VERIFIED" as const, "Verify your email first.")
    : failure("PROFILE_UNAVAILABLE" as const, "The Hunters are temporarily unavailable.");
}

/**
 * The Hunters wall: verified members, a page at a time, and a small random
 * handful for the homepage. Who is listed, and what about them, is decided by
 * the database (`list_public_hunters`); this checks the viewer first only so
 * a refusal reads as the right sentence.
 */
export class HuntersService {
  constructor(private readonly repository: HuntersRepository) {}

  async list(actor: ProfileActor | null, input: unknown): Promise<ListHuntersResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to see the Hunters.");
    if (!actor.emailVerified) return failure("EMAIL_NOT_VERIFIED", "Verify your email first.");
    const parsed = listHuntersInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "Choose 10, 15 or 20 Hunters per page.");
    }
    const { pageSize, page } = parsed.data;
    try {
      let result = await this.repository.listPage(pageSize, page);
      let served = page;
      // An old link can point past the end once members leave the wall; show
      // the last page rather than an empty board that has Hunters on it.
      if (result.items.length === 0 && result.total > 0 && page > 1) {
        served = Math.ceil(result.total / pageSize);
        result = await this.repository.listPage(pageSize, served);
      }
      return success({ items: result.items, page: served, pageSize, total: result.total });
    } catch (error) {
      return refusal(error);
    }
  }

  /**
   * A few Hunters in random order, drawn from one random page of twenty: every
   * Hunter while there are twenty or fewer, a random block beyond that.
   */
  async sample(
    actor: ProfileActor | null,
    count: number,
    random: () => number = Math.random,
  ): Promise<SampleHuntersResult> {
    if (!actor) return failure("AUTH_REQUIRED", "Sign in to see the Hunters.");
    if (!actor.emailVerified) return failure("EMAIL_NOT_VERIFIED", "Verify your email first.");
    try {
      let pool = await this.repository.listPage(SAMPLE_POOL, 1);
      const pages = Math.ceil(pool.total / SAMPLE_POOL);
      if (pages > 1) {
        const page = 1 + Math.min(pages - 1, Math.floor(random() * pages));
        if (page > 1) pool = await this.repository.listPage(SAMPLE_POOL, page);
      }
      const items = [...pool.items];
      for (let index = items.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [items[index], items[other]] = [items[other]!, items[index]!];
      }
      return success(items.slice(0, count));
    } catch (error) {
      return refusal(error);
    }
  }
}
