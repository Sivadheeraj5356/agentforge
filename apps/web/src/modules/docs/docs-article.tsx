import type { ReactElement } from "react";

import { DocsCodeBlock } from "./docs-code-block";
import type { DocsBlock, DocsSection } from "./types";

function DocsTable({
  headers,
  rows,
  caption,
}: {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  caption?: string;
}): ReactElement {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-lg">
        {caption ? (
          <caption className="text-muted-foreground mb-2 text-left text-base">{caption}</caption>
        ) : null}
        <thead>
          <tr className="border-border border-b">
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="text-muted-foreground py-2.5 pr-4 font-mono text-sm font-medium uppercase tracking-[0.12em]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.join("|")} className="border-border border-b last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}-${cellIndex}-${cell.slice(0, 24)}`}
                  className="text-foreground py-3 pr-4 align-top leading-relaxed"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocsBlockView({ block }: { block: DocsBlock }): ReactElement {
  switch (block.kind) {
    case "paragraph":
      return <p className="text-muted-foreground text-lg leading-relaxed">{block.text}</p>;
    case "heading":
      return (
        <h2 id={block.id} className="scroll-mt-28 font-serif text-2xl tracking-tight">
          {block.title}
        </h2>
      );
    case "code":
      return (
        <DocsCodeBlock language={block.language} code={block.code} filename={block.filename} />
      );
    case "table":
      return <DocsTable headers={block.headers} rows={block.rows} caption={block.caption} />;
    case "list":
      if (block.ordered) {
        return (
          <ol className="text-muted-foreground flex list-decimal flex-col gap-2.5 pl-5 text-lg leading-relaxed">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="text-muted-foreground flex list-disc flex-col gap-2.5 pl-5 text-lg leading-relaxed">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "diagram":
      return (
        <figure className="border-border bg-muted/30 overflow-x-auto rounded-md border">
          {block.title ? (
            <figcaption className="text-muted-foreground border-border border-b px-3 py-2 font-mono text-sm tracking-tight">
              {block.title}
            </figcaption>
          ) : null}
          <pre
            className="p-4 font-mono text-base leading-relaxed"
            aria-label={block.title ?? "Diagram"}
          >
            {block.lines.join("\n")}
          </pre>
        </figure>
      );
    case "note":
      return (
        <aside className="border-border bg-surface border-l-accent rounded-md border border-l-[3px] px-4 py-3">
          {block.title ? (
            <p className="text-muted-foreground mb-1 font-mono text-sm uppercase tracking-[0.14em]">
              {block.title}
            </p>
          ) : null}
          <p className="text-lg leading-relaxed">{block.text}</p>
        </aside>
      );
    default: {
      const exhaustive: never = block;
      throw new Error(`Unsupported docs block: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function DocsArticle({ section }: { section: DocsSection }): ReactElement {
  return (
    <article className="flex flex-col gap-5">
      {section.blocks.map((block, index) => (
        <DocsBlockView
          key={
            block.kind === "heading"
              ? block.id
              : block.kind === "code"
                ? `${block.filename ?? block.language}-${index}`
                : `${block.kind}-${index}`
          }
          block={block}
        />
      ))}
    </article>
  );
}
