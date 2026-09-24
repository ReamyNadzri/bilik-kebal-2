import { z } from "zod";
import type { OperationResult } from "./operation-result";

/**
 * A member cannot type their own campus, faculty, programme, course, session,
 * resource type or tag into a request. They ask a Sheriff to add it to the
 * shared lists, and are told in the app and by email when it is decided.
 */
export const taxonomyRequestCategories = [
  "campus",
  "faculty",
  "programme",
  "course",
  "academic_session",
  "resource_type",
  "tag",
] as const;
export type TaxonomyRequestCategory = (typeof taxonomyRequestCategories)[number];

export const TAXONOMY_CATEGORY_LABEL: Readonly<Record<TaxonomyRequestCategory, string>> = {
  campus: "Campus",
  faculty: "Faculty",
  programme: "Programme",
  course: "Course",
  academic_session: "Academic session",
  resource_type: "Resource type",
  tag: "Tag",
};

export type TaxonomyRequestCode =
  | "AUTH_REQUIRED"
  | "INSTITUTION_VERIFICATION_REQUIRED"
  | "NOT_AUTHORIZED"
  | "VALIDATION_ERROR"
  | "REQUEST_LIMIT_REACHED"
  | "REQUEST_NOT_FOUND"
  | "COURSE_CODE_EXISTS"
  | "TAXONOMY_REQUESTS_UNAVAILABLE";

export const taxonomyRequestInputSchema = z
  .object({
    category: z.enum(taxonomyRequestCategories),
    label: z.string().trim().min(2).max(160),
    courseCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/)
      .optional(),
    /** The faculty of a programme, or the programme of a course. */
    parentId: z.uuid().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.category !== "programme" || value.parentId !== undefined, {
    path: ["parentId"],
  })
  .refine(
    (value) =>
      value.category !== "course" ||
      (value.parentId !== undefined && value.courseCode !== undefined),
    { path: ["courseCode"] },
  );
export type TaxonomyRequestInput = z.input<typeof taxonomyRequestInputSchema>;

export const taxonomyDecisionSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
  /** Campus requests only: open the new campus for requests straight away. */
  openRegion: z.boolean().optional(),
});
export type TaxonomyDecisionInput = z.input<typeof taxonomyDecisionSchema>;

export interface TaxonomyRequestView {
  id: string;
  category: TaxonomyRequestCategory;
  label: string;
  courseCode: string | null;
  parentName: string | null;
  note: string | null;
  state: "pending" | "approved" | "rejected";
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  /** Sheriff queue only: who asked. */
  requesterName?: string;
}

export type SubmitTaxonomyRequestResult = OperationResult<
  { requestId: string; state: "pending" },
  TaxonomyRequestCode
>;
export type ListTaxonomyRequestsResult = OperationResult<
  TaxonomyRequestView[],
  TaxonomyRequestCode
>;
export type DecideTaxonomyRequestResult = OperationResult<
  { state: "approved" | "rejected" },
  TaxonomyRequestCode
>;
