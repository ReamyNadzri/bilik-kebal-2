import { z } from "zod";
import type { OperationResult } from "./operation-result";

/**
 * Reporting a Wanted (migration 202610190004) and the Owner's removal of one
 * (migration 202610190005).
 *
 * A report is private evidence for a human reviewer: only Sheriffs and the
 * Owner read the queue, and a report changes nothing by itself. Removal is the
 * Owner's alone, takes a written reason, and settles the money: the poster
 * (the breacher) forfeits their own contributions and every other Backer is
 * refunded in full.
 */
export const WANTED_REPORT_CATEGORIES = [
  "rules_breach",
  "copyright",
  "personal_data",
  "scam_or_fraud",
  "harassment",
  "spam",
  "other",
] as const;
export type WantedReportCategory = (typeof WANTED_REPORT_CATEGORIES)[number];

export const WANTED_REPORT_LABEL: Record<WantedReportCategory, string> = {
  rules_breach: "Breaks the rules or the terms",
  copyright: "Asks for copyrighted or restricted material",
  personal_data: "Shows someone's personal details",
  scam_or_fraud: "Scam or fraud",
  harassment: "Harassment or hate",
  spam: "Spam or duplicate",
  other: "Something else",
};

export const reportWantedInputSchema = z.object({
  category: z.enum(WANTED_REPORT_CATEGORIES),
  details: z.string().trim().max(500).optional(),
});
export type ReportWantedInput = z.input<typeof reportWantedInputSchema>;

export const ownerRemoveWantedInputSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
});

export type WantedReportCode =
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "NOT_ELIGIBLE"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "NOT_AUTHORIZED"
  | "PAID_OUT"
  | "REMOVAL_UNAVAILABLE"
  | "REPORTS_UNAVAILABLE";

export type ReportWantedResult = OperationResult<
  { outcome: "reported" | "already_reported" },
  WantedReportCode
>;

export interface WantedReportItem {
  id: string;
  wantedPublicId: string;
  wantedTitle: string;
  wantedStatus: string;
  category: WantedReportCategory;
  details: string | null;
  createdAt: string;
  /** How many members reported the same Wanted. */
  reportCount: number;
}

export type ListWantedReportsResult = OperationResult<WantedReportItem[], WantedReportCode>;
export type DismissWantedReportResult = OperationResult<{ done: true }, WantedReportCode>;
export type OwnerRemoveWantedResult = OperationResult<
  { refunds: number; forfeitedSen: number },
  WantedReportCode
>;
