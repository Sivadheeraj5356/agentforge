import { z } from "zod";

/** Project slug: lowercase letters, numbers, hyphens; no leading/trailing hyphen. */
export const ProjectSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid project slug");

export const ProjectNameSchema = z.string().trim().min(1).max(120);

export const ProjectDescriptionSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export const ProjectStatusSchema = z.enum(["active", "archived"]);

export const ProjectSortSchema = z.enum(["updated_desc", "updated_asc", "name_asc", "name_desc"]);

export const CreateProjectInputSchema = z.object({
  name: ProjectNameSchema,
  description: ProjectDescriptionSchema,
});

export const UpdateProjectInputSchema = z.object({
  name: ProjectNameSchema,
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((value) => (value.length > 0 ? value : null)),
});

export const ProjectListQuerySchema = z.object({
  status: z.enum(["active", "archived", "all"]).default("active"),
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  sort: ProjectSortSchema.default("updated_desc"),
});

export type ProjectSlug = z.infer<typeof ProjectSlugSchema>;
export type ProjectName = z.infer<typeof ProjectNameSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectSort = z.infer<typeof ProjectSortSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;
export type ProjectListQuery = z.infer<typeof ProjectListQuerySchema>;

/** Normalize a candidate project slug from a display name. */
export function slugifyProjectName(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");

  if (normalized.length >= 2) {
    return normalized;
  }
  return "project";
}

/** Append a numeric suffix for collision retries, keeping max length. */
export function projectSlugWithSuffix(base: string, attempt: number): string {
  if (attempt <= 0) {
    return base.slice(0, 64);
  }
  const suffix = `-${attempt + 1}`;
  const maxBase = 64 - suffix.length;
  const trimmed = base.slice(0, Math.max(2, maxBase)).replace(/-+$/g, "");
  const candidate = `${trimmed.length >= 2 ? trimmed : "project"}${suffix}`;
  return candidate.slice(0, 64);
}
