/**
 * Validates post-auth redirect targets to prevent open redirects.
 * Only same-origin relative paths starting with `/` are allowed.
 */
export function getSafeRedirectPath(
  candidate: string | null | undefined,
  fallback = "/app",
): string {
  if (!candidate) {
    return fallback;
  }

  const value = candidate.trim();
  if (!value.startsWith("/")) {
    return fallback;
  }
  if (value.startsWith("//")) {
    return fallback;
  }
  if (value.includes("://")) {
    return fallback;
  }
  if (value.includes("\\")) {
    return fallback;
  }
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return fallback;
    }
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
    return fallback;
  }

  return value;
}
