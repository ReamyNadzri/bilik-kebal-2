import { z } from "zod";
import type { OperationResult } from "./operation-result";

/**
 * The member console: people management and moderation for the Owner and
 * Sheriffs (migrations 202610100003 and 202610100004). Every action is a
 * database function that checks the caller's role, needs a sign-in in the last
 * 15 minutes, and is audited. There is no raw database editing and no money.
 */

export type ConsoleRole = "owner" | "platform_sheriff" | "institution_sheriff";

export type ConsoleOperationCode =
  | "AUTH_REQUIRED"
  | "NOT_AUTHORIZED"
  | "RECENT_AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "MEMBER_NOT_FOUND"
  | "ALREADY_RESTRICTED"
  | "CONSOLE_UNAVAILABLE";

export interface ConsoleMember {
  publicId: string;
  displayName: string;
  /** Only for the Owner and platform Sheriffs. */
  email: string | null;
  joinedAt: string;
  emailVerified: boolean;
  institution: {
    id: string;
    name: string;
    state: "unverified" | "pending" | "verified" | "rejected";
  } | null;
  /** "owner", "platform_sheriff", or "institution_sheriff:<institution id>". */
  roles: string[];
  restriction: {
    reasonCode: string;
    restrictedAt: string;
    /** Null for a permanent restriction. */
    expiresAt: string | null;
  } | null;
  badge: { id: string; name: string } | null;
}

export interface HiddenReply {
  id: string;
  body: string;
  hiddenAt: string;
  reasonCode: string;
  author: { publicId: string; displayName: string };
  hiddenBy: string | null;
  wanted: { id: string; title: string };
}

export interface ConsoleBadge {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  retired: boolean;
  holders: number;
}

/** Minimal badge shown beside a member's name. */
export interface MemberBadge {
  name: string;
  imageUrl: string | null;
}

const reasonCode = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
/**
 * Any UUID-shaped id from the database. Not `z.uuid()`, which also demands an
 * RFC version and variant and so refused hand-seeded rows such as
 * 10000000-0000-0000-0000-000000000001 before the database ever saw them.
 */
const databaseId = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const TIMEOUT_HOURS = [1, 24, 168] as const;

export const consoleMemberActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rename"),
    name: z.string().trim().min(1).max(100),
    reasonCode,
  }),
  z.object({ action: z.literal("reset_avatar"), reasonCode }),
  z.object({
    action: z.literal("timeout"),
    hours: z.union([z.literal(1), z.literal(24), z.literal(168)]),
    reasonCode,
  }),
  z.object({ action: z.literal("restrict"), reasonCode }),
  z.object({ action: z.literal("lift") }),
  z.object({
    action: z.literal("set_verification"),
    institutionId: databaseId,
    verified: z.boolean(),
    reasonCode,
  }),
  z.object({
    action: z.literal("set_sheriff"),
    /** Null: platform Sheriff. Otherwise institution Sheriff there. */
    institutionId: databaseId.nullable(),
    appoint: z.boolean(),
  }),
  z.object({ action: z.literal("set_badge"), badgeId: databaseId.nullable() }),
]);
export type ConsoleMemberAction = z.infer<typeof consoleMemberActionSchema>;

export const createBadgeSchema = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(160).optional(),
  imageKey: z
    .string()
    .regex(/^[0-9a-f-]{36}\.(png|webp)$/)
    .optional(),
});

export const badgeUploadSchema = z.object({
  contentType: z.enum(["image/png", "image/webp"]),
});

export type SearchMembersResult = OperationResult<ConsoleMember[], ConsoleOperationCode>;
export type ConsoleActionResult = OperationResult<{ done: true }, ConsoleOperationCode>;
export type ConsoleRoleResult = OperationResult<ConsoleRole | null, ConsoleOperationCode>;
export type ListHiddenRepliesResult = OperationResult<HiddenReply[], ConsoleOperationCode>;
export type ListBadgesResult = OperationResult<ConsoleBadge[], ConsoleOperationCode>;
export type CreateBadgeResult = OperationResult<{ badgeId: string }, ConsoleOperationCode>;
export type BadgeUploadResult = OperationResult<
  { signedUrl: string; token: string; imageKey: string },
  ConsoleOperationCode
>;
