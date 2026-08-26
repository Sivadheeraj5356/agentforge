-- Chunk 7: read-only task inspector.
-- Additive only. Chunk 5 and Chunk 6 migrations are history and are not rewritten;
-- no historical validation result is recomputed or overwritten here.
--
-- Three additions, each earning its place:
--   1. validation_runs.run_number  — a human-readable per-project run identifier so
--      the UI never has to present a UUID as a primary label.
--   2. validation_run_tasks        — which tasks a run's package contained, with the
--      slug the inspector routes on. Per-run and immutable: the same package
--      re-validated later gets its own rows.
--   3. validation_run_files        — the file manifest of the pinned artifact. It
--      renders the tree without touching object storage and, more importantly, it
--      is the allow-list for file reads.

-- ---------------------------------------------------------------------------
-- 1. Human-readable run number
-- ---------------------------------------------------------------------------

alter table public.validation_runs add column run_number integer;

update public.validation_runs r
set run_number = ranked.position
from (
  select
    id,
    row_number() over (partition by project_id order by created_at, id) as position
  from public.validation_runs
) as ranked
where ranked.id = r.id
  and r.run_number is null;

-- The placeholder default is never observed: the BEFORE INSERT trigger always
-- replaces it. It exists so the column is optional at the insert boundary, which
-- keeps "the database owns run numbering" true in the generated types too.
alter table public.validation_runs alter column run_number set default 0;

create or replace function public.validation_runs_assign_run_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Callers never choose a run number; any supplied value is discarded.
  -- Serialize numbering per project so two concurrent ingests cannot collide.
  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));

  select coalesce(max(vr.run_number), 0) + 1 into new.run_number
  from public.validation_runs vr
  where vr.project_id = new.project_id;

  return new;
end;
$$;

create trigger validation_runs_assign_run_number
  before insert on public.validation_runs
  for each row execute function public.validation_runs_assign_run_number();

create or replace function public.validation_runs_protect_run_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.run_number is distinct from old.run_number then
    raise exception 'validation run number is immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger validation_runs_protect_run_number
  before update on public.validation_runs
  for each row execute function public.validation_runs_protect_run_number();

alter table public.validation_runs
  alter column run_number set not null,
  add constraint validation_runs_run_number_positive check (run_number >= 1),
  add constraint validation_runs_project_id_run_number_unique unique (project_id, run_number);

comment on column public.validation_runs.run_number is
  'Per-project sequential display identifier. The UUID stays internal.';

-- ---------------------------------------------------------------------------
-- 2. Per-run task provenance
-- ---------------------------------------------------------------------------

create table public.validation_run_tasks (
  id uuid primary key default gen_random_uuid(),
  validation_run_id uuid not null references public.validation_runs (id) on delete cascade,
  ordinal integer not null,
  slug text not null,
  external_key text not null,
  root_path text not null,
  name text not null,
  task_version text,
  created_at timestamptz not null default now(),
  constraint validation_run_tasks_ordinal_nonneg check (ordinal >= 0),
  constraint validation_run_tasks_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(slug) >= 1
    and char_length(slug) <= 64
  ),
  constraint validation_run_tasks_external_key_length check (
    char_length(external_key) >= 1 and char_length(external_key) <= 128
  ),
  constraint validation_run_tasks_root_path_length check (char_length(root_path) <= 1024),
  constraint validation_run_tasks_root_path_relative check (
    root_path not like '/%'
    and root_path not like '%..%'
    and root_path !~ '^[A-Za-z]:'
  ),
  constraint validation_run_tasks_name_length check (
    char_length(name) >= 1 and char_length(name) <= 200
  ),
  constraint validation_run_tasks_name_trimmed check (name = btrim(name)),
  constraint validation_run_tasks_task_version_format check (
    task_version is null
    or (
      task_version ~ '^[A-Za-z0-9]+([._-][A-Za-z0-9]+)*$'
      and char_length(task_version) <= 64
    )
  ),
  constraint validation_run_tasks_run_id_slug_unique unique (validation_run_id, slug),
  constraint validation_run_tasks_run_id_ordinal_unique unique (validation_run_id, ordinal)
);

create index validation_run_tasks_validation_run_id_idx
  on public.validation_run_tasks (validation_run_id);
create index validation_run_tasks_slug_idx on public.validation_run_tasks (slug);

comment on table public.validation_run_tasks is
  'Tasks discovered inside one run''s pinned artifact. Immutable per run; a later run records its own rows.';

-- ---------------------------------------------------------------------------
-- 3. Artifact file manifest
-- ---------------------------------------------------------------------------

create table public.validation_run_files (
  id uuid primary key default gen_random_uuid(),
  validation_run_id uuid not null references public.validation_runs (id) on delete cascade,
  path text not null,
  byte_size bigint not null,
  created_at timestamptz not null default now(),
  constraint validation_run_files_path_length check (
    char_length(path) >= 1 and char_length(path) <= 1024
  ),
  -- Postgres text cannot hold a NUL byte, so path shape is all that needs checking
  -- here; traversal and absolute forms are also refused before the insert.
  constraint validation_run_files_path_relative check (
    path not like '/%'
    and path not like '%..%'
    and path not like '%\%'
    and path !~ '^[A-Za-z]:'
  ),
  constraint validation_run_files_byte_size_nonneg check (byte_size >= 0),
  constraint validation_run_files_run_id_path_unique unique (validation_run_id, path)
);

create index validation_run_files_validation_run_id_idx
  on public.validation_run_files (validation_run_id);

comment on table public.validation_run_files is
  'File manifest of a run''s pinned artifact. Also the allow-list for reading file contents.';

-- ---------------------------------------------------------------------------
-- Immutability: a recorded run's provenance never changes
-- ---------------------------------------------------------------------------

create or replace function public.validation_run_children_are_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'validation run detail rows are immutable'
    using errcode = '23514';
end;
$$;

create trigger validation_run_tasks_protect_immutable
  before update on public.validation_run_tasks
  for each row execute function public.validation_run_children_are_immutable();

create trigger validation_run_files_protect_immutable
  before update on public.validation_run_files
  for each row execute function public.validation_run_children_are_immutable();

-- ---------------------------------------------------------------------------
-- RLS: org-scoped through the owning validation run, same as validation_findings
-- ---------------------------------------------------------------------------

alter table public.validation_run_tasks enable row level security;
alter table public.validation_run_files enable row level security;
alter table public.validation_run_tasks force row level security;
alter table public.validation_run_files force row level security;

create policy validation_run_tasks_select_member
  on public.validation_run_tasks for select to authenticated
  using (app_private.is_validation_run_organization_member(validation_run_id));

create policy validation_run_tasks_insert_owner_admin
  on public.validation_run_tasks for insert to authenticated
  with check (app_private.is_validation_run_organization_owner_or_admin(validation_run_id));

create policy validation_run_files_select_member
  on public.validation_run_files for select to authenticated
  using (app_private.is_validation_run_organization_member(validation_run_id));

create policy validation_run_files_insert_owner_admin
  on public.validation_run_files for insert to authenticated
  with check (app_private.is_validation_run_organization_owner_or_admin(validation_run_id));

grant select, insert on public.validation_run_tasks to authenticated;
grant select, insert on public.validation_run_files to authenticated;
