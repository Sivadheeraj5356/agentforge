/**
 * Returns true when a path is a safe relative path (no absolute roots,
 * no `..` segments). Used when accepting user-facing path strings for
 * artifact keys — not for executing filesystem commands.
 */
export function isSafeRelativePath(path: string): boolean {
  if (!path || path.trim() !== path) {
    return false;
  }
  if (path.startsWith("/") || path.startsWith("\\")) {
    return false;
  }
  if (/^[A-Za-z]:[\\/]/.test(path)) {
    return false;
  }
  const segments = path.split(/[/\\]/);
  return segments.every((segment) => segment !== ".." && segment !== "");
}
