import { MetadataParseError } from "./errors";

export type TomlValue = string | number | boolean | TomlValue[] | TomlTable;
export type TomlTable = { [key: string]: TomlValue };

/** Parsed table plus the 1-based line of every dotted key, so findings can cite lines. */
export type TomlDocument = {
  readonly table: TomlTable;
  readonly keyLines: ReadonlyMap<string, number>;
};

function parseScalar(raw: string, line: number): TomlValue {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "[]") return [];
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((item) => {
      const parsed = parseScalar(item, line);
      if (typeof parsed === "object") {
        throw new MetadataParseError("Nested TOML arrays are not supported.", line);
      }
      return parsed;
    });
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return Number.parseFloat(value);
  }
  if (/^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  throw new MetadataParseError(`Unsupported TOML value: ${value}`, line);
}

/**
 * Subset parser for Harbor/Terminus `task.toml` (tables, scalars, string arrays).
 * Records key lines. Never evaluates uploaded content.
 */
export function parseTomlDocument(source: string): TomlDocument {
  const root: TomlTable = {};
  const keyLines = new Map<string, number>();
  let currentTable: TomlTable = root;
  let currentPrefix = "";
  const lines = source.replaceAll("\r\n", "\n").split("\n");

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const withoutComment = rawLine.replace(/\s+#.*$/, "");
    const line = withoutComment.trim();
    if (!line || line.startsWith("#")) continue;

    const tableMatch = /^\[([A-Za-z0-9_]+)\]$/.exec(line);
    if (tableMatch?.[1]) {
      const name = tableMatch[1];
      const existing = root[name];
      if (existing && typeof existing === "object" && !Array.isArray(existing)) {
        currentTable = existing;
      } else {
        const table: TomlTable = {};
        root[name] = table;
        currentTable = table;
      }
      currentPrefix = name;
      keyLines.set(name, lineNumber);
      continue;
    }

    const equals = line.indexOf("=");
    if (equals <= 0) {
      throw new MetadataParseError(`Expected "key = value" in TOML.`, lineNumber);
    }
    const key = line.slice(0, equals).trim();
    currentTable[key] = parseScalar(line.slice(equals + 1), lineNumber);
    keyLines.set(currentPrefix ? `${currentPrefix}.${key}` : key, lineNumber);
  }

  return { table: root, keyLines };
}
