import type { ReactElement } from "react";
import Link from "next/link";

import type { ProjectListQuery } from "@agentforge/contracts";

import { FormSelect } from "@/components/form-select";

function hrefFor(
  organizationSlug: string,
  next: Partial<ProjectListQuery> & { status?: string; q?: string; sort?: string },
  current: ProjectListQuery,
): string {
  const params = new URLSearchParams();
  const status = next.status ?? current.status;
  const q = next.q ?? current.q;
  const sort = next.sort ?? current.sort;

  if (status && status !== "active") {
    params.set("status", status);
  }
  if (q) {
    params.set("q", q);
  }
  if (sort && sort !== "updated_desc") {
    params.set("sort", sort);
  }

  const query = params.toString();
  return query ? `/app/${organizationSlug}/projects?${query}` : `/app/${organizationSlug}/projects`;
}

export function ProjectFilters({
  organizationSlug,
  query,
}: {
  organizationSlug: string;
  query: ProjectListQuery;
}): ReactElement {
  const statuses = [
    { id: "active", label: "Active" },
    { id: "archived", label: "Archived" },
    { id: "all", label: "All" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Project status"
        className="border-border flex flex-wrap gap-1 border-b pb-3"
      >
        {statuses.map((status) => {
          const selected = query.status === status.id;
          return (
            <Link
              key={status.id}
              role="tab"
              aria-selected={selected}
              href={hrefFor(organizationSlug, { status: status.id }, query)}
              className={
                selected
                  ? "text-accent border-accent border-b-2 px-3 py-1.5 text-sm font-medium"
                  : "text-muted-foreground hover:text-foreground px-3 py-1.5 text-sm"
              }
            >
              {status.label}
            </Link>
          );
        })}
      </div>

      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {query.status !== "active" ? (
          <input type="hidden" name="status" value={query.status} />
        ) : null}
        {query.sort !== "updated_desc" ? (
          <input type="hidden" name="sort" value={query.sort} />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="project-search" className="text-muted-foreground text-xs font-medium">
            Search
          </label>
          <input
            id="project-search"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Search by name or description"
            className="border-border bg-surface h-(--height-control) w-full rounded-md border px-3 text-sm"
          />
        </div>
        <div className="w-full sm:w-52">
          <FormSelect
            id="project-sort"
            name="sort"
            label="Sort"
            defaultValue={query.sort}
            options={[
              { value: "updated_desc", label: "Recently updated" },
              { value: "updated_asc", label: "Oldest updated" },
              { value: "name_asc", label: "Name A-Z" },
              { value: "name_desc", label: "Name Z-A" },
            ]}
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-(--height-control) rounded-md px-3.5 text-sm font-medium"
        >
          Apply
        </button>
      </form>
    </div>
  );
}
