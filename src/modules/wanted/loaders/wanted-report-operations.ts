import type { SupabaseClient } from "@supabase/supabase-js";
import { failure, success } from "@/contracts/operation-result";
import {
  ownerRemoveWantedInputSchema,
  reportWantedInputSchema,
  type DismissWantedReportResult,
  type ListWantedReportsResult,
  type OwnerRemoveWantedResult,
  type ReportWantedResult,
  type WantedReportCategory,
} from "@/contracts/wanted-reports";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestSupabaseClient, getRequestUser } from "@/lib/supabase/server";

/**
 * Reports and the Owner's removal, through the database functions of
 * migrations 202610190004 and 202610190005. Every call runs on the viewer's
 * own session, so the functions decide who may do what; nothing here grants
 * a permission.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reason(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
}

async function client(): Promise<SupabaseClient> {
  return (await getRequestSupabaseClient()) as unknown as SupabaseClient;
}

export async function reportWanted(publicId: string, input: unknown): Promise<ReportWantedResult> {
  if (!UUID.test(publicId)) return failure("NOT_FOUND", "This Wanted could not be found.");
  const parsed = reportWantedInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure("VALIDATION_ERROR", "Choose a reason, and keep the note to 500 characters.");
  }
  try {
    const { data, error } = await (
      await client()
    ).rpc("report_wanted", {
      target_public_id: publicId,
      target_category: parsed.data.category,
      target_details: parsed.data.details ?? null,
    });
    if (error) {
      const why = reason(error);
      if (why.includes("not_eligible")) {
        return failure(
          "NOT_ELIGIBLE",
          "Reporting needs institution verification, and you cannot report your own Wanted.",
        );
      }
      if (why.includes("not_found")) return failure("NOT_FOUND", "This Wanted could not be found.");
      if (why.includes("rate_limited")) {
        return failure("RATE_LIMITED", "You have sent many reports today. Try again tomorrow.");
      }
      return failure("REPORTS_UNAVAILABLE", "Your report could not be sent. Try again.");
    }
    return success({ outcome: data === "already_reported" ? "already_reported" : "reported" });
  } catch {
    return failure("REPORTS_UNAVAILABLE", "Your report could not be sent. Try again.");
  }
}

interface ReportRow {
  id: string;
  wanted_public_id: string;
  wanted_title: string;
  wanted_status: string;
  category: WantedReportCategory;
  details: string | null;
  created_at: string;
  report_count: number | string;
}

export async function listWantedReports(): Promise<ListWantedReportsResult> {
  try {
    const { data, error } = await (
      await client()
    ).rpc("list_wanted_reports", {
      target_status: "pending",
    });
    if (error) {
      return reason(error).includes("reviewers_only")
        ? failure("NOT_AUTHORIZED", "Reports are for Sheriffs and the Owner.")
        : failure("REPORTS_UNAVAILABLE", "Reports could not be loaded.");
    }
    return success(
      ((data ?? []) as ReportRow[]).map((row) => ({
        id: row.id,
        wantedPublicId: row.wanted_public_id,
        wantedTitle: row.wanted_title,
        wantedStatus: row.wanted_status,
        category: row.category,
        details: row.details,
        createdAt: new Date(row.created_at).toISOString(),
        reportCount: Number(row.report_count),
      })),
    );
  } catch {
    return failure("REPORTS_UNAVAILABLE", "Reports could not be loaded.");
  }
}

export async function dismissWantedReport(id: string): Promise<DismissWantedReportResult> {
  if (!UUID.test(id)) return failure("NOT_FOUND", "That report could not be found.");
  try {
    const { error } = await (
      await client()
    ).rpc("dismiss_wanted_report", {
      target_report_id: id,
    });
    if (error) {
      return reason(error).includes("reviewers_only")
        ? failure("NOT_AUTHORIZED", "Reports are for Sheriffs and the Owner.")
        : failure("REPORTS_UNAVAILABLE", "The report could not be dismissed.");
    }
    return success({ done: true as const });
  } catch {
    return failure("REPORTS_UNAVAILABLE", "The report could not be dismissed.");
  }
}

export async function ownerRemoveWanted(
  publicId: string,
  input: unknown,
): Promise<OwnerRemoveWantedResult> {
  if (!UUID.test(publicId)) return failure("NOT_FOUND", "This Wanted could not be found.");
  const parsed = ownerRemoveWantedInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure("VALIDATION_ERROR", "Write the reason for removing it, at least 10 characters.");
  }
  try {
    const { data, error } = await (
      await client()
    ).rpc("owner_remove_wanted", {
      target_public_id: publicId,
      target_reason: parsed.data.reason,
    });
    if (error) {
      const why = reason(error);
      if (why.includes("owner_only")) {
        return failure("NOT_AUTHORIZED", "Only the Owner can remove a Wanted.");
      }
      if (why.includes("owner_removal_reason")) {
        return failure(
          "VALIDATION_ERROR",
          "Write the reason for removing it, at least 10 characters.",
        );
      }
      if (why.includes("not_found")) {
        return failure("NOT_FOUND", "This Wanted is already removed, or never left the draft.");
      }
      if (why.includes("paid_out")) {
        return failure(
          "PAID_OUT",
          "A payout exists for this Wanted. Settle the payout before removing it.",
        );
      }
      return failure("REMOVAL_UNAVAILABLE", "The Wanted could not be removed. Nothing changed.");
    }
    const body = (data ?? {}) as { refunds?: number; forfeitedSen?: number };
    return success({
      refunds: Number(body.refunds ?? 0),
      forfeitedSen: Number(body.forfeitedSen ?? 0),
    });
  } catch {
    return failure("REMOVAL_UNAVAILABLE", "The Wanted could not be removed. Nothing changed.");
  }
}

/** Whether the signed-in viewer holds the Owner role. Shows the control only; the database decides. */
export async function viewerIsOwner(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await getRequestUser();
    if (!user) return false;
    const { data } = await createSupabaseAdminClient()
      .from("platform_role_assignments")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();
    return data !== null;
  } catch {
    return false;
  }
}
