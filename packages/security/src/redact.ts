const SECRET_PATTERNS: RegExp[] = [
  /\b(sk-[A-Za-z0-9_-]{10,})\b/g,
  /\b(Bearer\s+)[A-Za-z0-9._-]+/gi,
  /\b(api[_-]?key\s*[:=]\s*)([^\s,;]+)/gi,
];

/** Redacts common secret-shaped substrings from log-safe strings. */
export function redactSecrets(input: string): string {
  let result = input;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match, group1: string | undefined) => {
      if (group1 && match !== group1) {
        return `${group1}[REDACTED]`;
      }
      return "[REDACTED]";
    });
  }
  return result;
}
