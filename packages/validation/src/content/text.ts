/**
 * Turning untrusted bytes into text that is safe to *display*. Nothing here
 * interprets the content: no HTML, no Markdown, no terminal emulation. A task
 * package is evidence, and evidence is shown verbatim minus the sequences that
 * would let it control the surrounding surface.
 */

/** Files at or under this size render in full. */
export const FULL_RENDER_MAX_BYTES = 256 * 1024;
/** Files over `FULL_RENDER_MAX_BYTES` and under this render as a truncated preview. */
export const PREVIEW_MAX_BYTES = 2 * 1024 * 1024;
/** Lines kept when a file is previewed rather than rendered in full. */
export const PREVIEW_MAX_LINES = 2000;
/** Hard ceiling on a single rendered line; longer lines are cut with a marker. */
export const MAX_RENDERED_LINE_CHARACTERS = 2000;

/** Stand-in for anything removed. Never delete silently: that misreports evidence. */
const REPLACEMENT = "\uFFFD";

const ESCAPE = 0x1b;
const BELL = 0x07;
const TAB = 0x09;
const LINE_FEED = 0x0a;
const DELETE = 0x7f;
const C1_START = 0x80;
const C1_END = 0x9f;

/**
 * `full` — the whole file.
 * `preview` — the first `PREVIEW_MAX_LINES` lines, clearly marked as partial.
 * `metadata` — nothing but size and path; the file is too large to send to a browser.
 * `binary` — not decodable as UTF-8 text.
 */
export type FileRenderMode = "full" | "preview" | "metadata" | "binary";

export type TextFilePreview = {
  readonly mode: FileRenderMode;
  readonly byteSize: number;
  /** Sanitized lines, without trailing newline characters. Empty for `metadata`/`binary`. */
  readonly lines: readonly string[];
  /** Lines the file actually has, when known. Null when the file was not decoded. */
  readonly totalLines: number | null;
  /** True when `lines` is a prefix of the file. */
  readonly truncated: boolean;
  /** True when at least one line was cut at `MAX_RENDERED_LINE_CHARACTERS`. */
  readonly hasClippedLines: boolean;
};

/** Size-only decision, made before any bytes are decoded. */
export function classifyBySize(byteSize: number): Exclude<FileRenderMode, "binary"> {
  if (byteSize <= FULL_RENDER_MAX_BYTES) {
    return "full";
  }
  return byteSize <= PREVIEW_MAX_BYTES ? "preview" : "metadata";
}

function isDisallowedControl(code: number): boolean {
  if (code === TAB || code === LINE_FEED) {
    return false;
  }
  return code < 0x20 || code === DELETE || (code >= C1_START && code <= C1_END);
}

/** Overrides that can visually reorder a line so it reads as something it is not. */
function isBidiOverride(code: number): boolean {
  return (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
}

/** Length of the ANSI escape sequence starting at `start`, including the ESC. */
function escapeSequenceLength(value: string, start: number): number {
  const next = value.charCodeAt(start + 1);
  if (Number.isNaN(next)) {
    return 1;
  }

  // CSI: ESC [ parameters intermediates final
  if (next === 0x5b) {
    let index = start + 2;
    while (index < value.length) {
      const code = value.charCodeAt(index);
      if (code >= 0x40 && code <= 0x7e) {
        return index - start + 1;
      }
      if (code < 0x20 || code > 0x3f) {
        break;
      }
      index += 1;
    }
    return index - start;
  }

  // OSC: ESC ] ... BEL, or ESC ] ... ESC \
  if (next === 0x5d) {
    let index = start + 2;
    while (index < value.length) {
      const code = value.charCodeAt(index);
      if (code === BELL) {
        return index - start + 1;
      }
      if (code === ESCAPE) {
        return value.charCodeAt(index + 1) === 0x5c ? index - start + 2 : index - start;
      }
      index += 1;
    }
    return index - start;
  }

  return 2;
}

/**
 * Neutralizes terminal escape sequences, control characters, and bidirectional
 * overrides, replacing each removed run with U+FFFD.
 *
 * Written as a scanner rather than a regular expression: a regex over the control
 * range needs a lint suppression, and a single pass over the string is cheaper for
 * the file sizes this viewer accepts.
 */
export function sanitizeDisplayText(value: string): string {
  let result = "";
  let copiedTo = 0;
  let index = 0;

  while (index < value.length) {
    const code = value.charCodeAt(index);
    let consumed = 0;

    if (code === ESCAPE) {
      consumed = escapeSequenceLength(value, index);
    } else if (isDisallowedControl(code) || isBidiOverride(code)) {
      consumed = 1;
    }

    if (consumed === 0) {
      index += 1;
      continue;
    }

    result += value.slice(copiedTo, index) + REPLACEMENT;
    index += consumed;
    copiedTo = index;
  }

  return copiedTo === 0 ? value : result + value.slice(copiedTo);
}

function clipLine(line: string): { readonly text: string; readonly clipped: boolean } {
  if (line.length <= MAX_RENDERED_LINE_CHARACTERS) {
    return { text: line, clipped: false };
  }
  return { text: `${line.slice(0, MAX_RENDERED_LINE_CHARACTERS)}${REPLACEMENT}`, clipped: true };
}

/** Splits on LF after normalizing CRLF and lone CR, so line numbers match an editor. */
export function splitDisplayLines(value: string): readonly string[] {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Decodes and sanitizes file bytes for display, applying the documented size
 * thresholds. A file classified as `metadata` is never decoded, so an oversized
 * entry cannot cost a multi-megabyte string on the server or in the response.
 */
export function buildTextFilePreview(bytes: Uint8Array): TextFilePreview {
  const byteSize = bytes.byteLength;
  const sizeMode = classifyBySize(byteSize);

  if (sizeMode === "metadata") {
    return {
      mode: "metadata",
      byteSize,
      lines: [],
      totalLines: null,
      truncated: true,
      hasClippedLines: false,
    };
  }

  const decoded = decodeUtf8(bytes);
  if (decoded === null) {
    return {
      mode: "binary",
      byteSize,
      lines: [],
      totalLines: null,
      truncated: false,
      hasClippedLines: false,
    };
  }

  const allLines = splitDisplayLines(decoded);
  const keep = sizeMode === "preview" ? allLines.slice(0, PREVIEW_MAX_LINES) : allLines;

  let hasClippedLines = false;
  const lines = keep.map((line) => {
    const { text, clipped } = clipLine(sanitizeDisplayText(line));
    hasClippedLines ||= clipped;
    return text;
  });

  return {
    mode: sizeMode,
    byteSize,
    lines,
    totalLines: allLines.length,
    truncated: lines.length < allLines.length,
    hasClippedLines,
  };
}
