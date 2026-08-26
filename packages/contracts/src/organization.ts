import { z } from "zod";

/** Organization slug: lowercase letters, numbers, hyphens; no leading/trailing hyphen. */
export const OrganizationSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid organization slug");

export const OrganizationNameSchema = z.string().trim().min(1).max(80);

export const DisplayNameSchema = z.string().trim().min(1).max(80);

export const OrganizationRoleSchema = z.enum(["owner", "admin", "member"]);
export const WorkflowRoleSchema = z.enum(["reviewer", "adjudicator"]);
export const FindingReviewDecisionSchema = z.enum(["accept", "reject", "comment"]);
export const PrivacyClassSchema = z.enum(["PRIVATE", "INTERNAL", "RESTRICTED"]);
export const EnvironmentAdapterIdSchema = z.enum(["harbor", "isolated", "unsupported", "work"]);
export const EvaluationGateMetricSchema = z.enum(["pass_at_1", "mean_reward"]);
export const WebhookEventSchema = z.enum([
  "evaluation.completed",
  "evaluation.failed",
  "regression.detected",
]);

export type OrganizationSlug = z.infer<typeof OrganizationSlugSchema>;
export type OrganizationName = z.infer<typeof OrganizationNameSchema>;
export type DisplayName = z.infer<typeof DisplayNameSchema>;
export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;
export type WorkflowRole = z.infer<typeof WorkflowRoleSchema>;
export type FindingReviewDecision = z.infer<typeof FindingReviewDecisionSchema>;
export type PrivacyClass = z.infer<typeof PrivacyClassSchema>;

/** Normalize a candidate slug for uniqueness checks / display. */
export function normalizeOrganizationSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
