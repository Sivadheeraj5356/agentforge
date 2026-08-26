# ADR-017: The file viewer is a read-only renderer, not an embedded editor

## Status

Accepted

## Context

The inspector needs line numbers, syntax colouring, in-file search, line selection,
and safe handling of large files. The reflex answer is Monaco (or CodeMirror), and
both would work.

Both also bring an editing engine we would never enable: a document model, undo
history, IME and multi-cursor support, language services, and web workers. Monaco
is measured in megabytes and needs bundler and worker configuration to behave in
Next.js. The repository's standing constraints are "no unnecessary dependencies"
and "no new animation/dialog/editor library duplicates", and the panel is
explicitly read-only.

There is also a safety argument. An editor accepts a document and renders it
through its own pipeline. A renderer we own accepts an array of already-sanitized
strings and puts them in text nodes. The second one is much easier to prove
correct, and "package content can never become markup" is a property this product
has to hold.

## Decision

No embedded editor. The viewer is:

- a `<table>` of line number, finding marker, and content, so line numbers are not
  selectable with the text and a screen reader gets real row semantics;
- a per-line tokenizer (`modules/tasks/highlight.ts`) covering the languages a
  Terminus package actually contains — Dockerfile, shell, TOML, YAML, JSON, Python,
  Markdown — that returns **typed tokens**, never HTML strings;
- a substring search over the already-loaded lines;
- documented size thresholds in `@agentforge/validation`: full render to 256 KB,
  truncated preview to 2 MB, metadata only beyond that, and never any render for
  content that is not valid UTF-8.

The viewer is still loaded with `next/dynamic`, so the tokenizer and the render
loop stay out of the initial route bundle and out of the page for a reviewer who
only reads findings.

## Consequences

- Highlighting is line-scoped: a triple-quoted Python string or a fenced Markdown
  block is coloured line by line rather than as one span. Acceptable for reading
  evidence; it would not be acceptable for editing.
- No code folding, no minimap, no go-to-definition. None of those help a reviewer
  decide whether a task package is well formed.
- Adding a language is a small entry in one table rather than a grammar package.
- If a later chunk genuinely needs editing, this decision gets revisited then —
  and there is exactly one viewer to replace, not two to reconcile.
