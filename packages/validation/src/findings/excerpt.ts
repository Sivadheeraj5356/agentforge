import type { ValidatorOptions } from "@agentforge/contracts";

function clamp(lines: readonly string[], options: ValidatorOptions): string | null {
  if (lines.length === 0) {
    return null;
  }
  const text = lines.slice(0, options.maxExcerptLines).join("\n");
  return text.slice(0, options.maxExcerptCharacters);
}

/** Leading lines of a file, bounded by the configured excerpt limits. */
export function excerptFromText(text: string, options: ValidatorOptions): string | null {
  return clamp(text.split("\n"), options);
}

/** Only the lines matching a pattern, so evidence points at the offending config. */
export function excerptMatchingLines(
  text: string,
  pattern: RegExp,
  options: ValidatorOptions,
): string | null {
  return clamp(
    text.split("\n").filter((line) => pattern.test(line)),
    options,
  );
}

/** 1-based line of the first match, or null. Never guess a line number. */
export function findFirstLine(text: string, pattern: RegExp): number | null {
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    if (pattern.test(line)) {
      return index + 1;
    }
  }
  return null;
}

/**
 * 1-based line containing a literal substring. Used when the needle comes from
 * uploaded content, so it is never compiled into a regular expression.
 */
export function findFirstLineContaining(text: string, needle: string): number | null {
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    if (line.includes(needle)) {
      return index + 1;
    }
  }
  return null;
}
