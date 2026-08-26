export type DocsParagraph = {
  readonly kind: "paragraph";
  readonly text: string;
};

export type DocsHeading = {
  readonly kind: "heading";
  readonly id: string;
  readonly title: string;
};

export type DocsCode = {
  readonly kind: "code";
  readonly language: string;
  readonly code: string;
  readonly filename?: string;
};

export type DocsTable = {
  readonly kind: "table";
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly caption?: string;
};

export type DocsList = {
  readonly kind: "list";
  readonly items: readonly string[];
  readonly ordered?: boolean;
};

export type DocsDiagram = {
  readonly kind: "diagram";
  readonly lines: readonly string[];
  readonly title?: string;
};

export type DocsNote = {
  readonly kind: "note";
  readonly text: string;
  readonly title?: string;
};

export type DocsBlock =
  | DocsParagraph
  | DocsHeading
  | DocsCode
  | DocsTable
  | DocsList
  | DocsDiagram
  | DocsNote;

export const DOCS_NAV_GROUP_IDS = ["get-started", "product", "packs", "architecture"] as const;

export type DocsNavGroupId = (typeof DOCS_NAV_GROUP_IDS)[number];

export const DOCS_NAV_GROUP_LABELS: Record<DocsNavGroupId, string> = {
  "get-started": "Get started",
  product: "Product",
  packs: "Packs",
  architecture: "Architecture",
};

export type DocsSection = {
  readonly id: string;
  readonly title: string;
  readonly group: DocsNavGroupId;
  readonly summary: string;
  readonly blocks: readonly DocsBlock[];
};

export function paragraph(text: string): DocsParagraph {
  return { kind: "paragraph", text };
}

export function heading(id: string, title: string): DocsHeading {
  return { kind: "heading", id, title };
}

export function code(language: string, source: string, filename?: string): DocsCode {
  return filename ? { kind: "code", language, code: source, filename } : { kind: "code", language, code: source };
}

export function table(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  caption?: string,
): DocsTable {
  return caption ? { kind: "table", headers, rows, caption } : { kind: "table", headers, rows };
}

export function bullet(items: readonly string[]): DocsList {
  return { kind: "list", items };
}

export function numbered(items: readonly string[]): DocsList {
  return { kind: "list", items, ordered: true };
}

export function diagram(lines: readonly string[], title?: string): DocsDiagram {
  return title ? { kind: "diagram", lines, title } : { kind: "diagram", lines };
}

export function note(text: string, title?: string): DocsNote {
  return title ? { kind: "note", text, title } : { kind: "note", text };
}

export function blockPlainText(block: DocsBlock): readonly string[] {
  switch (block.kind) {
    case "paragraph":
      return [block.text];
    case "heading":
      return [block.title];
    case "code":
      return block.filename ? [block.filename, block.code] : [block.code];
    case "table":
      return [
        ...(block.caption ? [block.caption] : []),
        ...block.headers,
        ...block.rows.flat(),
      ];
    case "list":
      return block.items;
    case "diagram":
      return block.title ? [block.title, ...block.lines] : [...block.lines];
    case "note":
      return block.title ? [block.title, block.text] : [block.text];
    default: {
      const exhaustive: never = block;
      return [exhaustive];
    }
  }
}

export function sectionHeadings(section: DocsSection): readonly DocsHeading[] {
  return section.blocks.filter((block): block is DocsHeading => block.kind === "heading");
}

export function sectionSearchText(section: DocsSection): string {
  return [section.title, ...section.blocks.flatMap((block) => blockPlainText(block))]
    .join("\n")
    .toLowerCase();
}
