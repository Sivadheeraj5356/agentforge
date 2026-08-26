# ADR-016: Task file contents are served through one scoped route, gated by the run's manifest

## Status

Accepted

## Context

The task inspector shows a reviewer the files inside a validated package. That
means untrusted, tenant-owned bytes have to travel from object storage to a
browser, on demand, one file at a time.

The obvious implementations are all wrong for this product:

- A generic `/api/files?key=…` endpoint turns object keys into a client-controlled
  parameter. Keys are guessable enough to be dangerous and the endpoint becomes a
  filesystem API the moment anyone adds a convenience feature to it.
- A signed URL for arbitrary keys moves the same problem to the storage layer, and
  a signed URL cannot be revoked by an authorization check that happens later.
- Sending every file body with the page wastes bandwidth on a package that can hold
  2048 files, and the spec is explicit that file bodies must not load before
  selection.
- Shipping storage credentials to the client is disqualifying.

There is also a caching question. Historical runs are immutable, so their file
contents can be cached hard — but a cache that is populated before the
authorization check, or that is shared across tenants, is a data leak.

## Decision

**One route, scoped by its own path.**
`/app/[organizationSlug]/projects/[projectSlug]/tasks/[taskSlug]/runs/[runId]/file?path=…`
is the only way a file body leaves the server. Organization, project, task, and run
all come from the URL path and are resolved through RLS. The single query parameter
is a package-relative path.

**The run's file manifest is the allow-list.** `validation_run_files` records every
file of the pinned artifact at ingest. A read is refused unless the requested path,
after normalization, appears in that manifest _and_ falls inside the requested
task's scope (its own root, plus files outside every task root). There is no
parameter for an object key, an artifact id, or a filesystem location.

**Path validation refuses rather than resolves.** The request path goes through
`WorkspaceRelativePathSchema` and then `normalizeWorkspacePath`, which rejects
`..` in any segment, absolute paths, drive letters, UNC prefixes, and NUL bytes —
the same rules validators live under.

**Object keys stay server-generated.** The key comes from the `artifacts` row that
the run pins; it was built at ingest from an organization id, a fresh UUID, and the
content hash. An uploaded filename never becomes a key.

**Authorization precedes every cache decision.** Unauthenticated requests get 401
with `no-store`. Anything the caller is not entitled to gets 404 with `no-store`,
so a cross-tenant resource is indistinguishable from one that does not exist. Only
after a successful authorization does a completed run's response carry
`private, max-age=3600, immutable` — `private` because the body belongs to one
organization, `immutable` because the run pins an artifact that cannot change.

**The response is JSON, not bytes.** Content is decoded, size-classified, and
sanitized on the server and returned as an array of lines. There is no
content-sniffing surface and no path by which package content becomes markup.

## Consequences

- The read path cannot be widened accidentally: adding a file to the response
  requires adding it to a manifest at ingest time.
- A run created before this chunk has no manifest, so its files are not browsable.
  Historical results are untouched, which is the trade we want.
- Each file read re-reads the archive from the artifact store. Bounded by
  `MAX_UPLOAD_ARCHIVE_BYTES` (32 MB) and only pays on a cache miss, but a
  cross-request byte cache is the obvious next optimization if artifacts move to
  remote storage.
- The route is tied to the inspector's URL shape. A future API surface would add
  its own route with its own authorization rather than reusing this one.
- `runs/[runId]` carries the per-project **run number**, not the row UUID. The
  internal identifier never appears in a URL a reviewer can copy.
