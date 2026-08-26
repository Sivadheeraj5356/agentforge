/**
 * A very small read-only tokenizer for the file viewer.
 *
 * It returns typed tokens, never HTML: the viewer renders each token as a React
 * element, so uploaded content can never become markup. Tokenizing is per line and
 * has no notion of multi-line strings or fenced blocks — a deliberate trade for
 * something that stays a few hundred bytes of shipped JavaScript instead of an
 * embedded editor.
 */

export type TokenKind = "plain" | "comment" | "string" | "keyword" | "number" | "key";

export type Token = {
  readonly kind: TokenKind;
  readonly text: string;
};

export type HighlightLanguage =
  "dockerfile" | "shell" | "toml" | "yaml" | "json" | "python" | "markdown" | "plain";

type LanguageSpec = {
  readonly commentPrefixes: readonly string[];
  readonly quotes: readonly string[];
  readonly keywords: ReadonlySet<string>;
  /** Highlights `key =` / `key:` at the start of a line. */
  readonly keyValue: boolean;
  readonly caseInsensitiveKeywords: boolean;
};

const DOCKERFILE_INSTRUCTIONS = [
  "add",
  "arg",
  "cmd",
  "copy",
  "entrypoint",
  "env",
  "expose",
  "from",
  "healthcheck",
  "label",
  "run",
  "shell",
  "stopsignal",
  "user",
  "volume",
  "workdir",
];

const SHELL_KEYWORDS = [
  "case",
  "do",
  "done",
  "elif",
  "else",
  "esac",
  "export",
  "fi",
  "for",
  "function",
  "if",
  "in",
  "local",
  "return",
  "set",
  "then",
  "while",
];

const PYTHON_KEYWORDS = [
  "and",
  "assert",
  "as",
  "break",
  "class",
  "continue",
  "def",
  "elif",
  "else",
  "except",
  "False",
  "finally",
  "for",
  "from",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "None",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "True",
  "try",
  "while",
  "with",
  "yield",
];

const LANGUAGES: Record<HighlightLanguage, LanguageSpec> = {
  dockerfile: {
    commentPrefixes: ["#"],
    quotes: ['"', "'"],
    keywords: new Set(DOCKERFILE_INSTRUCTIONS),
    keyValue: false,
    caseInsensitiveKeywords: true,
  },
  shell: {
    commentPrefixes: ["#"],
    quotes: ['"', "'"],
    keywords: new Set(SHELL_KEYWORDS),
    keyValue: false,
    caseInsensitiveKeywords: false,
  },
  toml: {
    commentPrefixes: ["#"],
    quotes: ['"', "'"],
    keywords: new Set(["true", "false"]),
    keyValue: true,
    caseInsensitiveKeywords: false,
  },
  yaml: {
    commentPrefixes: ["#"],
    quotes: ['"', "'"],
    keywords: new Set(["true", "false", "null"]),
    keyValue: true,
    caseInsensitiveKeywords: false,
  },
  json: {
    commentPrefixes: [],
    quotes: ['"'],
    keywords: new Set(["true", "false", "null"]),
    keyValue: false,
    caseInsensitiveKeywords: false,
  },
  python: {
    commentPrefixes: ["#"],
    quotes: ['"', "'"],
    keywords: new Set(PYTHON_KEYWORDS),
    keyValue: false,
    caseInsensitiveKeywords: false,
  },
  markdown: {
    commentPrefixes: [],
    quotes: ["`"],
    keywords: new Set(),
    keyValue: false,
    caseInsensitiveKeywords: false,
  },
  plain: {
    commentPrefixes: [],
    quotes: [],
    keywords: new Set(),
    keyValue: false,
    caseInsensitiveKeywords: false,
  },
};

const EXTENSION_LANGUAGES: Record<string, HighlightLanguage> = {
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  toml: "toml",
  yaml: "yaml",
  yml: "yaml",
  json: "json",
  py: "python",
  md: "markdown",
  markdown: "markdown",
  dockerfile: "dockerfile",
};

const FILENAME_LANGUAGES: Record<string, HighlightLanguage> = {
  dockerfile: "dockerfile",
  makefile: "shell",
  "docker-compose.yaml": "yaml",
  "docker-compose.yml": "yaml",
};

export function detectLanguage(path: string): HighlightLanguage {
  const fileName = (path.split("/").at(-1) ?? path).toLowerCase();
  const byName = FILENAME_LANGUAGES[fileName];
  if (byName) {
    return byName;
  }
  const extension = fileName.includes(".") ? (fileName.split(".").at(-1) ?? "") : "";
  return EXTENSION_LANGUAGES[extension] ?? "plain";
}

function isWordCharacter(character: string): boolean {
  return /[A-Za-z0-9_$.-]/.test(character);
}

function readString(line: string, start: number, quote: string): number {
  let index = start + 1;
  while (index < line.length) {
    const character = line[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    index += 1;
    if (character === quote) {
      return index;
    }
  }
  return line.length;
}

function matchesCommentPrefix(line: string, index: number, spec: LanguageSpec): boolean {
  return spec.commentPrefixes.some((prefix) => line.startsWith(prefix, index));
}

function leadingKeyLength(line: string, spec: LanguageSpec): number {
  if (!spec.keyValue) {
    return 0;
  }
  const match = /^\s*[A-Za-z0-9_.\-[\]"']+(?=\s*[:=])/.exec(line);
  return match ? match[0].length : 0;
}

function push(tokens: Token[], kind: TokenKind, text: string): void {
  if (text.length === 0) {
    return;
  }
  const last = tokens.at(-1);
  if (last && last.kind === kind) {
    tokens[tokens.length - 1] = { kind, text: last.text + text };
    return;
  }
  tokens.push({ kind, text });
}

/** Tokenizes one line. Always returns tokens whose text concatenates back to `line`. */
export function tokenizeLine(line: string, language: HighlightLanguage): readonly Token[] {
  const spec = LANGUAGES[language];
  const tokens: Token[] = [];
  let index = leadingKeyLength(line, spec);

  if (index > 0) {
    push(tokens, "key", line.slice(0, index));
  }

  while (index < line.length) {
    const character = line[index] ?? "";

    if (matchesCommentPrefix(line, index, spec)) {
      push(tokens, "comment", line.slice(index));
      return tokens;
    }

    if (spec.quotes.includes(character)) {
      const end = readString(line, index, character);
      push(tokens, "string", line.slice(index, end));
      index = end;
      continue;
    }

    if (isWordCharacter(character)) {
      let end = index;
      while (end < line.length && isWordCharacter(line[end] ?? "")) {
        end += 1;
      }
      const word = line.slice(index, end);
      const lookup = spec.caseInsensitiveKeywords ? word.toLowerCase() : word;
      if (spec.keywords.has(lookup)) {
        push(tokens, "keyword", word);
      } else if (/^-?\d+(?:\.\d+)?$/.test(word)) {
        push(tokens, "number", word);
      } else {
        push(tokens, "plain", word);
      }
      index = end;
      continue;
    }

    push(tokens, "plain", character);
    index += 1;
  }

  return tokens;
}
