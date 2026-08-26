-- Chunk 4: benchmark-agnostic evaluation domain.
-- Terminal Bench / Terminus is an adapter later — no terminus_task_id columns.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'benchmark_status') then
    create type public.benchmark_status as enum ('draft', 'published', 'retired');
  end if;
  if not exists (select 1 from pg_type where typname = 'submission_kind') then
    create type public.submission_kind as enum (
      'uploaded_archive',
      'git_repository',
      'git_commit',
      'generated_task',
      'benchmark_provided',
      'internal_package'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'evaluation_run_status') then
    create type public.evaluation_run_status as enum (
      'queued',
      'running',
      'succeeded',
      'failed',
      'cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'artifact_kind') then
    create type public.artifact_kind as enum (
      'archive',
      'log',
      'trace',
      'image',
      'json',
      'other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'evaluation_result_kind') then
    create type public.evaluation_result_kind as enum (
      'score',
      'pass_fail',
      'raw',
      'other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'agent_type') then
    create type public.agent_type as enum ('model', 'harness', 'composite');
  end if;
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type public.review_status as enum ('open', 'resolved', 'dismissed');
  end if;
  if not exists (select 1 from pg_type where typname = 'finding_severity') then
    create type public.finding_severity as enum (
      'info',
      'low',
      'medium',
      'high',
      'critical'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'finding_status') then
    create type public.finding_status as enum (
      'open',
      'acknowledged',
      'resolved',
      'dismissed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'finding_source') then
    create type public.finding_source as enum ('human', 'system', 'adapter');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Catalog: benchmarks, versions, tasks, agents
-- ---------------------------------------------------------------------------

create table public.benchmarks (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  name text not null,
  description text,
  provider text not null,
  status public.benchmark_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint benchmarks_key_format check (
    key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(key) >= 2
    and char_length(key) <= 64
  ),
  constraint benchmarks_key_unique unique (key),
  constraint benchmarks_name_length check (
    char_length(name) >= 1 and char_length(name) <= 120
  ),
  constraint benchmarks_name_trimmed check (name = btrim(name)),
  constraint benchmarks_description_length check (
    description is null or char_length(description) <= 4000
  ),
  constraint benchmarks_provider_format check (
    provider ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(provider) >= 2
    and char_length(provider) <= 64
  )
);

create table public.benchmark_versions (
  id uuid primary key default gen_random_uuid(),
  benchmark_id uuid not null references public.benchmarks (id) on delete cascade,
  version text not null,
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint benchmark_versions_version_format check (
    version ~ '^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*$'
    and char_length(version) >= 1
    and char_length(version) <= 64
    and lower(version) <> 'latest'
  ),
  constraint benchmark_versions_benchmark_id_version_unique unique (benchmark_id, version),
  constraint benchmark_versions_manifest_object check (jsonb_typeof(manifest) = 'object'),
  constraint benchmark_versions_manifest_size check (octet_length(manifest::text) <= 65536)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  benchmark_version_id uuid not null references public.benchmark_versions (id) on delete cascade,
  external_key text not null,
  name text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_external_key_format check (
    external_key ~ '^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*$'
    and char_length(external_key) >= 1
    and char_length(external_key) <= 128
  ),
  constraint tasks_benchmark_version_id_external_key_unique unique (benchmark_version_id, external_key),
  constraint tasks_name_length check (
    char_length(name) >= 1 and char_length(name) <= 200
  ),
  constraint tasks_name_trimmed check (name = btrim(name)),
  constraint tasks_description_length check (
    description is null or char_length(description) <= 4000
  ),
  constraint tasks_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint tasks_metadata_size check (octet_length(metadata::text) <= 16384)
);

create table public.task_versions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  version text not null,
  created_at timestamptz not null default now(),
  constraint task_versions_version_format check (
    version ~ '^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*$'
    and char_length(version) >= 1
    and char_length(version) <= 64
    and lower(version) <> 'latest'
  ),
  constraint task_versions_task_id_version_unique unique (task_id, version)
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  name text not null,
  version text not null,
  type public.agent_type not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agents_provider_format check (
    provider ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(provider) >= 2
    and char_length(provider) <= 64
  ),
  constraint agents_name_length check (
    char_length(name) >= 1 and char_length(name) <= 120
  ),
  constraint agents_name_trimmed check (name = btrim(name)),
  constraint agents_version_format check (
    version ~ '^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*$'
    and char_length(version) >= 1
    and char_length(version) <= 64
    and lower(version) <> 'latest'
  ),
  constraint agents_provider_name_version_unique unique (provider, name, version),
  constraint agents_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint agents_metadata_size check (octet_length(metadata::text) <= 8192)
);

-- Optional project ↔ catalog pin (nullable; not required)
alter table public.projects
  add column benchmark_id uuid references public.benchmarks (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Tenant: submissions, artifacts, evaluation runs/results, reviews, audit
-- ---------------------------------------------------------------------------

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind public.submission_kind not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint submissions_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint submissions_metadata_size check (octet_length(metadata::text) <= 8192)
);

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind public.artifact_kind not null,
  content_hash text not null,
  byte_size bigint not null,
  content_type text not null,
  storage_key text,
  created_at timestamptz not null default now(),
  constraint artifacts_content_hash_sha256 check (content_hash ~ '^[a-f0-9]{64}$'),
  constraint artifacts_byte_size_non_negative check (byte_size >= 0),
  constraint artifacts_byte_size_max check (byte_size <= 53687091200),
  constraint artifacts_content_type_length check (
    char_length(content_type) >= 3 and char_length(content_type) <= 255
  ),
  constraint artifacts_storage_key_safe check (
    storage_key is null
    or (
      char_length(storage_key) >= 1
      and char_length(storage_key) <= 1024
      and storage_key not like '%..%'
      and storage_key not like '/%'
    )
  )
);

create table public.evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  submission_id uuid not null references public.submissions (id),
  benchmark_version_id uuid not null references public.benchmark_versions (id),
  task_version_id uuid not null references public.task_versions (id),
  agent_id uuid references public.agents (id),
  evaluator_configuration jsonb not null default '{}'::jsonb,
  status public.evaluation_run_status not null default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint evaluation_runs_evaluator_configuration_object check (
    jsonb_typeof(evaluator_configuration) = 'object'
  ),
  constraint evaluation_runs_evaluator_configuration_size check (
    octet_length(evaluator_configuration::text) <= 16384
  ),
  constraint evaluation_runs_status_times check (
    (status = 'queued' and started_at is null and completed_at is null)
    or (status = 'running' and started_at is not null and completed_at is null)
    or (
      status in ('succeeded', 'failed', 'cancelled')
      and completed_at is not null
    )
  )
);

create table public.evaluation_results (
  id uuid primary key default gen_random_uuid(),
  evaluation_run_id uuid not null references public.evaluation_runs (id) on delete cascade,
  result_kind public.evaluation_result_kind not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint evaluation_results_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint evaluation_results_payload_size check (octet_length(payload::text) <= 16384)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  evaluation_run_id uuid references public.evaluation_runs (id) on delete set null,
  created_by uuid not null references auth.users (id),
  status public.review_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  category text not null,
  severity public.finding_severity not null,
  title text not null,
  description text not null,
  evidence jsonb not null default '{}'::jsonb,
  recommendation text,
  source public.finding_source not null,
  status public.finding_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint findings_category_format check (
    category ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(category) >= 2
    and char_length(category) <= 64
  ),
  constraint findings_title_length check (
    char_length(title) >= 1 and char_length(title) <= 200
  ),
  constraint findings_title_trimmed check (title = btrim(title)),
  constraint findings_description_length check (
    char_length(description) >= 1 and char_length(description) <= 4000
  ),
  constraint findings_recommendation_length check (
    recommendation is null or char_length(recommendation) <= 4000
  ),
  constraint findings_evidence_object check (jsonb_typeof(evidence) = 'object'),
  constraint findings_evidence_size check (octet_length(evidence::text) <= 16384)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users (id),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_action_format check (
    action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'
    and char_length(action) >= 3
    and char_length(action) <= 80
  ),
  constraint audit_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint audit_events_metadata_size check (octet_length(metadata::text) <= 4096)
);

-- ---------------------------------------------------------------------------
-- Indexes (FKs + list/filter patterns)
-- ---------------------------------------------------------------------------

create index benchmarks_status_idx on public.benchmarks (status);
create index benchmark_versions_benchmark_id_idx
  on public.benchmark_versions (benchmark_id);
create index tasks_benchmark_version_id_idx on public.tasks (benchmark_version_id);
create index task_versions_task_id_idx on public.task_versions (task_id);
create index agents_provider_idx on public.agents (provider);
create index projects_benchmark_id_idx on public.projects (benchmark_id);

create index submissions_project_id_created_at_idx
  on public.submissions (project_id, created_at desc);
create index submissions_created_by_idx on public.submissions (created_by);

create index artifacts_organization_id_idx on public.artifacts (organization_id);
create index artifacts_content_hash_idx on public.artifacts (content_hash);

create index evaluation_runs_project_id_created_at_idx
  on public.evaluation_runs (project_id, created_at desc);
create index evaluation_runs_submission_id_idx on public.evaluation_runs (submission_id);
create index evaluation_runs_benchmark_version_id_idx
  on public.evaluation_runs (benchmark_version_id);
create index evaluation_runs_task_version_id_idx on public.evaluation_runs (task_version_id);
create index evaluation_runs_agent_id_idx on public.evaluation_runs (agent_id);
create index evaluation_runs_status_idx on public.evaluation_runs (status);

create index evaluation_results_evaluation_run_id_idx
  on public.evaluation_results (evaluation_run_id);

create index reviews_organization_id_idx on public.reviews (organization_id);
create index reviews_project_id_idx on public.reviews (project_id);
create index reviews_evaluation_run_id_idx on public.reviews (evaluation_run_id);

create index findings_review_id_idx on public.findings (review_id);

create index audit_events_organization_id_created_at_idx
  on public.audit_events (organization_id, created_at desc);
create index audit_events_project_id_idx on public.audit_events (project_id);
create index audit_events_actor_id_idx on public.audit_events (actor_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create trigger benchmarks_set_updated_at
  before update on public.benchmarks
  for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger agents_set_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

create trigger findings_set_updated_at
  before update on public.findings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers via project (no RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function app_private.is_project_organization_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and app_private.is_organization_member(p.organization_id)
  );
$$;

revoke all on function app_private.is_project_organization_member(uuid) from public;
grant execute on function app_private.is_project_organization_member(uuid) to authenticated;

create or replace function app_private.is_project_organization_owner_or_admin(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and app_private.is_organization_owner_or_admin(p.organization_id)
  );
$$;

revoke all on function app_private.is_project_organization_owner_or_admin(uuid) from public;
grant execute on function app_private.is_project_organization_owner_or_admin(uuid) to authenticated;

create or replace function app_private.is_review_organization_member(p_review_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reviews r
    where r.id = p_review_id
      and app_private.is_organization_member(r.organization_id)
  );
$$;

revoke all on function app_private.is_review_organization_member(uuid) from public;
grant execute on function app_private.is_review_organization_member(uuid) to authenticated;

create or replace function app_private.is_review_organization_owner_or_admin(p_review_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reviews r
    where r.id = p_review_id
      and app_private.is_organization_owner_or_admin(r.organization_id)
  );
$$;

revoke all on function app_private.is_review_organization_owner_or_admin(uuid) from public;
grant execute on function app_private.is_review_organization_owner_or_admin(uuid) to authenticated;

create or replace function app_private.is_evaluation_run_organization_member(p_evaluation_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.evaluation_runs er
    inner join public.projects p on p.id = er.project_id
    where er.id = p_evaluation_run_id
      and app_private.is_organization_member(p.organization_id)
  );
$$;

revoke all on function app_private.is_evaluation_run_organization_member(uuid) from public;
grant execute on function app_private.is_evaluation_run_organization_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Pin consistency + immutability
-- ---------------------------------------------------------------------------

create or replace function public.evaluation_runs_enforce_pins()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_submission_project uuid;
  v_task_benchmark_version uuid;
begin
  select s.project_id into v_submission_project
  from public.submissions s
  where s.id = new.submission_id;

  if v_submission_project is distinct from new.project_id then
    raise exception 'submission does not belong to project'
      using errcode = '23514';
  end if;

  select t.benchmark_version_id into v_task_benchmark_version
  from public.task_versions tv
  inner join public.tasks t on t.id = tv.task_id
  where tv.id = new.task_version_id;

  if v_task_benchmark_version is distinct from new.benchmark_version_id then
    raise exception 'task version is not pinned to the benchmark version'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger evaluation_runs_enforce_pins
  before insert or update on public.evaluation_runs
  for each row execute function public.evaluation_runs_enforce_pins();

create or replace function public.reviews_enforce_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_project_org uuid;
  v_run_org uuid;
begin
  if new.project_id is not null then
    select p.organization_id into v_project_org
    from public.projects p
    where p.id = new.project_id;

    if v_project_org is distinct from new.organization_id then
      raise exception 'review project is not in organization'
        using errcode = '23514';
    end if;
  end if;

  if new.evaluation_run_id is not null then
    select p.organization_id into v_run_org
    from public.evaluation_runs er
    inner join public.projects p on p.id = er.project_id
    where er.id = new.evaluation_run_id;

    if v_run_org is distinct from new.organization_id then
      raise exception 'review evaluation run is not in organization'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger reviews_enforce_scope
  before insert or update on public.reviews
  for each row execute function public.reviews_enforce_scope();

create or replace function public.audit_events_enforce_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_project_org uuid;
begin
  if new.project_id is not null then
    select p.organization_id into v_project_org
    from public.projects p
    where p.id = new.project_id;

    if v_project_org is distinct from new.organization_id then
      raise exception 'audit project is not in organization'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger audit_events_enforce_scope
  before insert on public.audit_events
  for each row execute function public.audit_events_enforce_scope();

create or replace function public.benchmark_versions_protect_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.benchmark_id is distinct from old.benchmark_id
    or new.version is distinct from old.version
    or new.manifest is distinct from old.manifest then
    raise exception 'benchmark versions are immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger benchmark_versions_protect_immutable
  before update on public.benchmark_versions
  for each row execute function public.benchmark_versions_protect_immutable();

create or replace function public.task_versions_protect_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.task_id is distinct from old.task_id
    or new.version is distinct from old.version then
    raise exception 'task versions are immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger task_versions_protect_immutable
  before update on public.task_versions
  for each row execute function public.task_versions_protect_immutable();

create or replace function public.submissions_protect_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id
    or new.created_by is distinct from old.created_by
    or new.kind is distinct from old.kind then
    raise exception 'submission identity columns are immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger submissions_protect_immutable
  before update on public.submissions
  for each row execute function public.submissions_protect_immutable();

create or replace function public.evaluation_runs_protect_pins()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id
    or new.submission_id is distinct from old.submission_id
    or new.benchmark_version_id is distinct from old.benchmark_version_id
    or new.task_version_id is distinct from old.task_version_id then
    raise exception 'evaluation run pins are immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger evaluation_runs_protect_pins
  before update on public.evaluation_runs
  for each row execute function public.evaluation_runs_protect_pins();

-- ---------------------------------------------------------------------------
-- Mutation audit (trusted DB, after successful row change; skips unauthenticated)
-- ---------------------------------------------------------------------------

create or replace function public.audit_project_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_action text;
begin
  if v_actor is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_action := 'project.created';
  elsif new.status is distinct from old.status then
    if new.status = 'archived' then
      v_action := 'project.archived';
    else
      v_action := 'project.restored';
    end if;
  else
    v_action := 'project.updated';
  end if;

  insert into public.audit_events (
    actor_id,
    organization_id,
    project_id,
    action,
    metadata
  )
  values (
    v_actor,
    new.organization_id,
    new.id,
    v_action,
    jsonb_build_object('slug', new.slug)
  );

  return new;
end;
$$;

revoke all on function public.audit_project_mutation() from public;

create trigger projects_audit_mutation
  after insert or update on public.projects
  for each row execute function public.audit_project_mutation();

create or replace function public.audit_submission_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_org uuid;
begin
  if v_actor is null then
    return new;
  end if;

  select p.organization_id into v_org
  from public.projects p
  where p.id = new.project_id;

  insert into public.audit_events (
    actor_id,
    organization_id,
    project_id,
    action,
    metadata
  )
  values (
    v_actor,
    v_org,
    new.project_id,
    'submission.created',
    jsonb_build_object('kind', new.kind::text)
  );

  return new;
end;
$$;

revoke all on function public.audit_submission_insert() from public;

create trigger submissions_audit_insert
  after insert on public.submissions
  for each row execute function public.audit_submission_insert();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.benchmarks enable row level security;
alter table public.benchmark_versions enable row level security;
alter table public.tasks enable row level security;
alter table public.task_versions enable row level security;
alter table public.agents enable row level security;
alter table public.submissions enable row level security;
alter table public.artifacts enable row level security;
alter table public.evaluation_runs enable row level security;
alter table public.evaluation_results enable row level security;
alter table public.reviews enable row level security;
alter table public.findings enable row level security;
alter table public.audit_events enable row level security;

alter table public.benchmarks force row level security;
alter table public.benchmark_versions force row level security;
alter table public.tasks force row level security;
alter table public.task_versions force row level security;
alter table public.agents force row level security;
alter table public.submissions force row level security;
alter table public.artifacts force row level security;
alter table public.evaluation_runs force row level security;
alter table public.evaluation_results force row level security;
alter table public.reviews force row level security;
alter table public.findings force row level security;
alter table public.audit_events force row level security;

-- Catalog: authenticated read, no client writes
create policy benchmarks_select_authenticated
  on public.benchmarks for select to authenticated
  using (true);

create policy benchmark_versions_select_authenticated
  on public.benchmark_versions for select to authenticated
  using (true);

create policy tasks_select_authenticated
  on public.tasks for select to authenticated
  using (true);

create policy task_versions_select_authenticated
  on public.task_versions for select to authenticated
  using (true);

create policy agents_select_authenticated
  on public.agents for select to authenticated
  using (true);

-- Submissions
create policy submissions_select_member
  on public.submissions for select to authenticated
  using (app_private.is_project_organization_member(project_id));

create policy submissions_insert_owner_admin
  on public.submissions for insert to authenticated
  with check (
    app_private.is_project_organization_owner_or_admin(project_id)
    and created_by = (select auth.uid())
  );

-- Artifacts (metadata only)
create policy artifacts_select_member
  on public.artifacts for select to authenticated
  using (app_private.is_organization_member(organization_id));

create policy artifacts_insert_owner_admin
  on public.artifacts for insert to authenticated
  with check (app_private.is_organization_owner_or_admin(organization_id));

-- Evaluation runs (model only; no worker)
create policy evaluation_runs_select_member
  on public.evaluation_runs for select to authenticated
  using (app_private.is_project_organization_member(project_id));

create policy evaluation_runs_insert_owner_admin
  on public.evaluation_runs for insert to authenticated
  with check (app_private.is_project_organization_owner_or_admin(project_id));

create policy evaluation_runs_update_owner_admin
  on public.evaluation_runs for update to authenticated
  using (app_private.is_project_organization_owner_or_admin(project_id))
  with check (app_private.is_project_organization_owner_or_admin(project_id));

-- Results: members read; writes reserved for future trusted writers
create policy evaluation_results_select_member
  on public.evaluation_results for select to authenticated
  using (app_private.is_evaluation_run_organization_member(evaluation_run_id));

-- Reviews / findings (boundary only; no AI reviewer)
create policy reviews_select_member
  on public.reviews for select to authenticated
  using (app_private.is_organization_member(organization_id));

create policy reviews_insert_owner_admin
  on public.reviews for insert to authenticated
  with check (
    app_private.is_organization_owner_or_admin(organization_id)
    and created_by = (select auth.uid())
  );

create policy reviews_update_owner_admin
  on public.reviews for update to authenticated
  using (app_private.is_organization_owner_or_admin(organization_id))
  with check (app_private.is_organization_owner_or_admin(organization_id));

create policy findings_select_member
  on public.findings for select to authenticated
  using (app_private.is_review_organization_member(review_id));

create policy findings_insert_owner_admin
  on public.findings for insert to authenticated
  with check (app_private.is_review_organization_owner_or_admin(review_id));

create policy findings_update_owner_admin
  on public.findings for update to authenticated
  using (app_private.is_review_organization_owner_or_admin(review_id))
  with check (app_private.is_review_organization_owner_or_admin(review_id));

-- Audit: members read org events; insert own actor row
create policy audit_events_select_member
  on public.audit_events for select to authenticated
  using (app_private.is_organization_member(organization_id));

create policy audit_events_insert_self
  on public.audit_events for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and app_private.is_organization_member(organization_id)
  );

-- Grants (RLS still applies). Catalog writes stay table-owner / service_role only.
grant select on public.benchmarks to authenticated;
grant select on public.benchmark_versions to authenticated;
grant select on public.tasks to authenticated;
grant select on public.task_versions to authenticated;
grant select on public.agents to authenticated;

grant select, insert on public.submissions to authenticated;
grant select, insert on public.artifacts to authenticated;
grant select, insert, update on public.evaluation_runs to authenticated;
grant select on public.evaluation_results to authenticated;
grant select, insert, update on public.reviews to authenticated;
grant select, insert, update on public.findings to authenticated;
grant select, insert on public.audit_events to authenticated;
