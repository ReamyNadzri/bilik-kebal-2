import { failure } from "@/contracts/operation-result";
import type {
  BadgeUploadResult,
  ConsoleActionResult,
  ConsoleRoleResult,
  CreateBadgeResult,
  ListBadgesResult,
  ListHiddenRepliesResult,
  SearchMembersResult,
} from "@/contracts/console";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseConsoleRepository } from "../repositories/supabase-console-repository";
import { ConsoleService } from "../services/console-service";

async function context() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return {
    actor: user ? { userId: user.id } : null,
    service: new ConsoleService(new SupabaseConsoleRepository(client)),
  };
}

const unavailable = () =>
  failure("CONSOLE_UNAVAILABLE" as const, "The console is unavailable. Try again.");

async function run<T>(operation: (loaded: Awaited<ReturnType<typeof context>>) => Promise<T>) {
  try {
    return await operation(await context());
  } catch {
    return unavailable();
  }
}

export const readConsoleRole = (): Promise<ConsoleRoleResult> =>
  run(({ actor, service }) => service.role(actor));

export const searchConsoleMembers = (search: string | null): Promise<SearchMembersResult> =>
  run(({ actor, service }) => service.search(actor, search));

export const actOnConsoleMember = (
  publicId: string,
  input: unknown,
): Promise<ConsoleActionResult> => run(({ actor, service }) => service.act(actor, publicId, input));

export const listConsoleHiddenReplies = (): Promise<ListHiddenRepliesResult> =>
  run(({ actor, service }) => service.hiddenReplies(actor));

export const restoreConsoleReply = (replyId: string): Promise<ConsoleActionResult> =>
  run(({ actor, service }) => service.restoreReply(actor, replyId));

export const listConsoleBadges = (): Promise<ListBadgesResult> =>
  run(({ actor, service }) => service.badges(actor));

export const createConsoleBadge = (input: unknown): Promise<CreateBadgeResult> =>
  run(({ actor, service }) => service.createBadge(actor, input));

export const retireConsoleBadge = (badgeId: string): Promise<ConsoleActionResult> =>
  run(({ actor, service }) => service.retireBadge(actor, badgeId));

export const prepareBadgeUpload = (input: unknown): Promise<BadgeUploadResult> =>
  run(({ actor, service }) => service.badgeUpload(actor, input));
