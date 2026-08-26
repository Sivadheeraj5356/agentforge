import { MetadataParseError } from "./errors";

export type YamlValue = string | number | boolean | YamlValue[] | YamlMap;
export type YamlMap = { [key: string]: YamlValue };

/** Parsed map plus the 1-based line of every top-level key. */
export type YamlDocument = {
  readonly map: YamlMap;
  readonly keyLines: ReadonlyMap<string, number>;
};

function parseInlineValue(raw: string, line: number): YamlValue {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~" || value === "") return "";
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => parseInlineValue(item, line));
  }
  if (/^-?\d+\.\d+$/.test(value)) return Number.parseFloat(value);
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (value.startsWith("&") || value.startsWith("*") || value === "<<") {
    throw new MetadataParseError("YAML anchors, aliases, and merge keys are rejected.", line);
  }
  return value;
}

/**
 * Conservative YAML subset for classic Terminal Bench `task.yaml`.
 * Rejects anchors/aliases (YAML bombs). Does not execute anything.
 */
export function parseYamlDocument(source: string): YamlDocument {
  if (/(?:^|\n)\s*<<\s*:/.test(source) || /(?:^|\n)\s*\S+:\s*[&*]/.test(source)) {
    throw new Error("YAML anchors, aliases, and merge keys are rejected.");
  }

  const root: YamlMap = {};
  const keyLines = new Map<string, number>();
  const lines = source
    .replaceAll("\r\n", "\n")
    .replace(/^\uFEFF/, "")
    .split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const lineNumber = index + 1;
    index += 1;
    if (line === undefined) break;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed === "---" || trimmed === "...") continue;

    const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(trimmed);
    if (!match?.[1]) {
      throw new MetadataParseError("Expected a top-level YAML mapping key.", lineNumber);
    }
    const key = match[1];
    const rest = match[2] ?? "";
    keyLines.set(key, lineNumber);

    if (rest === "|" || rest === "|-" || rest === ">" || rest === ">-") {
      const block: string[] = [];
      while (index < lines.length) {
        const next = lines[index];
        if (next === undefined) break;
        if (next.trim() === "") {
          block.push("");
          index += 1;
          continue;
        }
        if (/^\s/.test(next)) {
          block.push(next.replace(/^\s{2}/, ""));
          index += 1;
          continue;
        }
        break;
      }
      root[key] = block.join("\n").trimEnd();
      continue;
    }

    if (rest === "") {
      const list: YamlValue[] = [];
      let consumedList = false;
      while (index < lines.length) {
        const next = lines[index];
        if (next === undefined) break;
        const listMatch = /^\s*-\s+(.*)$/.exec(next);
        if (!listMatch?.[1]) break;
        consumedList = true;
        list.push(parseInlineValue(listMatch[1], index + 1));
        index += 1;
      }
      root[key] = consumedList ? list : "";
      continue;
    }

    root[key] = parseInlineValue(rest, lineNumber);
  }

  return { map: root, keyLines };
}
