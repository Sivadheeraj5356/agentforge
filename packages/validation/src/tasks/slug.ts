export const MAX_TASK_SLUG_LENGTH = 64;

const FALLBACK_TASK_SLUG = "task";

/**
 * URL-safe display identifier for a task discovered inside a package.
 *
 * Derived from the adapter's external key rather than a database id, so the same
 * package always yields the same task URL and a reviewer can read the address.
 * The result matches `^[a-z0-9]+(-[a-z0-9]+)*$`, which is the shape the database
 * and the route parser both enforce.
 */
export function taskSlugFromExternalKey(externalKey: string): string {
  const slug = externalKey
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, MAX_TASK_SLUG_LENGTH)
    .replaceAll(/-+$/g, "");
  return slug.length > 0 ? slug : FALLBACK_TASK_SLUG;
}

/**
 * Assigns unique slugs across the tasks of one package. Order in, order out, so a
 * re-run of the same package produces the same slugs and run-to-run links hold.
 */
export function assignTaskSlugs(externalKeys: readonly string[]): readonly string[] {
  const used = new Set<string>();
  return externalKeys.map((externalKey) => {
    const base = taskSlugFromExternalKey(externalKey);
    if (!used.has(base)) {
      used.add(base);
      return base;
    }
    for (let suffix = 2; ; suffix += 1) {
      const marker = `-${suffix}`;
      const candidate = `${base.slice(0, MAX_TASK_SLUG_LENGTH - marker.length)}${marker}`;
      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
    }
  });
}
