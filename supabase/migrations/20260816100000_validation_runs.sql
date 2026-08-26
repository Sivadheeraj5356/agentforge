-- Chunk 5: validation runs are distinct from evaluation_runs.
-- Findings from structural ingest do not reuse review-scoped public.findings.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'validation_run_status') then
    create type public.validation_run_status as enum (
      'queued',
      'running',
      'succeeded',
      'failed',
      'cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'validation_finding_severity') then
    create type public.validation_finding_severity as enum (
      'info',
      'warning',
      'error',
      'critical'
    );
  end if;
end
$$;

create table public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  artifact_id uuid not null references public.artifacts (id),
  submission_id uuid references public.submissions (id),
  benchmark_id uuid references public.benchmarks (id),
  benchmark_version_id uuid references public.benchmark_versions (id),
  adapter_id text,
  status public.validation_run_status not null default 'queued',
  configuration jsonb not null default '{}'::jsonb,
  error_message text,
  critical_count integer not null default 0,
  error_count integer not null default 0,
  warning_count integer not null default 0,
  info_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint validation_runs_adapter_id_format check (
    adapter_id is null
    or (
      adapter_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and char_length(adapter_id) >= 2
      and char_length(adapter_id) <= 64
    )
  ),
  constraint validation_runs_configuration_object check (jsonb_typeof(configuration) = 'object'),
  constraint validation_runs_configuration_size check (octet_length(configuration::text) <= 16384),
  constraint validation_runs_error_message_length check (
    error_message is null or char_length(error_message) <= 2000
  ),
  constraint validation_runs_counts_nonneg check (
    critical_count >= 0
    and error_count >= 0
    and warning_count >= 0
    and info_count >= 0
  ),
  constraint validation_runs_status_times check (
    (status = 'queued' and started_at is null and completed_at is null)
    or (status = 'running' and started_at is not null and completed_at is null)
    or (
      status in ('succeeded', 'failed', 'cancelled')
      and completed_at is not null
    )
  )
);

create table public.validation_findings (
  id uuid primary key default gen_random_uuid(),
  validation_run_id uuid not null references public.validation_runs (id) on delete cascade,
  code text not null,
  severity public.validation_finding_severity not null,
  title text not null,
  message text not null,
  evidence jsonb not null default '{}'::jsonb,
  remediation text,
  validator_id text,
  created_at timestamptz not null default now(),
  constraint validation_findings_code_format check (
    code ~ '^[A-Z][A-Z0-9_]*$'
    and char_length(code) >= 3
    and char_length(code) <= 80
  ),
  constraint validation_findings_title_length check (
    char_length(title) >= 1 and char_length(title) <= 200
  ),
  constraint validation_findings_title_trimmed check (title = btrim(title)),
  constraint validation_findings_message_length check (
    char_length(message) >= 1 and char_length(message) <= 4000
  ),
  constraint validation_findings_remediation_length check (
    remediation is null or char_length(remediation) <= 4000
  ),
  constraint validation_findings_validator_id_format check (
    validator_id is null
    or (
      validator_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and char_length(validator_id) >= 2
      and char_length(validator_id) <= 64
    )
  ),
  constraint validation_findings_evidence_object check (jsonb_typeof(evidence) = 'object'),
  constraint validation_findings_evidence_size check (octet_length(evidence::text) <= 16384)
);

create index validation_runs_project_id_created_at_idx
  on public.validation_runs (project_id, created_at desc);
create index validation_runs_artifact_id_idx on public.validation_runs (artifact_id);
create index validation_runs_status_idx on public.validation_runs (status);
create index validation_runs_benchmark_id_idx on public.validation_runs (benchmark_id);
create index validation_findings_validation_run_id_idx
  on public.validation_findings (validation_run_id);
create index validation_findings_code_idx on public.validation_findings (code);
create index validation_findings_severity_idx on public.validation_findings (severity);

create or replace function app_private.is_validation_run_organization_member(p_validation_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.validation_runs vr
    inner join public.projects p on p.id = vr.project_id
    where vr.id = p_validation_run_id
      and app_private.is_organization_member(p.organization_id)
  );
$$;

revoke all on function app_private.is_validation_run_organization_member(uuid) from public;
grant execute on function app_private.is_validation_run_organization_member(uuid) to authenticated;

create or replace function app_private.is_validation_run_organization_owner_or_admin(p_validation_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.validation_runs vr
    inner join public.projects p on p.id = vr.project_id
    where vr.id = p_validation_run_id
      and app_private.is_organization_owner_or_admin(p.organization_id)
  );
$$;

revoke all on function app_private.is_validation_run_organization_owner_or_admin(uuid) from public;
grant execute on function app_private.is_validation_run_organization_owner_or_admin(uuid) to authenticated;

create or replace function public.validation_runs_enforce_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_artifact_org uuid;
  v_project_org uuid;
  v_submission_project uuid;
begin
  select p.organization_id into v_project_org
  from public.projects p
  where p.id = new.project_id;

  select a.organization_id into v_artifact_org
  from public.artifacts a
  where a.id = new.artifact_id;

  if v_artifact_org is distinct from v_project_org then
    raise exception 'artifact does not belong to project organization'
      using errcode = '23514';
  end if;

  if new.submission_id is not null then
    select s.project_id into v_submission_project
    from public.submissions s
    where s.id = new.submission_id;

    if v_submission_project is distinct from new.project_id then
      raise exception 'submission does not belong to project'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger validation_runs_enforce_scope
  before insert or update on public.validation_runs
  for each row execute function public.validation_runs_enforce_scope();

create or replace function public.validation_runs_protect_pins()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id
    or new.artifact_id is distinct from old.artifact_id then
    raise exception 'validation run pins are immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger validation_runs_protect_pins
  before update on public.validation_runs
  for each row execute function public.validation_runs_protect_pins();

create or replace function public.audit_validation_run_insert()
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
    'validation_run.created',
    jsonb_build_object('status', new.status::text)
  );

  return new;
end;
$$;

revoke all on function public.audit_validation_run_insert() from public;

create trigger validation_runs_audit_insert
  after insert on public.validation_runs
  for each row execute function public.audit_validation_run_insert();

alter table public.validation_runs enable row level security;
alter table public.validation_findings enable row level security;
alter table public.validation_runs force row level security;
alter table public.validation_findings force row level security;

create policy validation_runs_select_member
  on public.validation_runs for select to authenticated
  using (app_private.is_project_organization_member(project_id));

create policy validation_runs_insert_owner_admin
  on public.validation_runs for insert to authenticated
  with check (app_private.is_project_organization_owner_or_admin(project_id));

create policy validation_runs_update_owner_admin
  on public.validation_runs for update to authenticated
  using (app_private.is_project_organization_owner_or_admin(project_id))
  with check (app_private.is_project_organization_owner_or_admin(project_id));

create policy validation_findings_select_member
  on public.validation_findings for select to authenticated
  using (app_private.is_validation_run_organization_member(validation_run_id));

create policy validation_findings_insert_owner_admin
  on public.validation_findings for insert to authenticated
  with check (app_private.is_validation_run_organization_owner_or_admin(validation_run_id));

grant select, insert, update on public.validation_runs to authenticated;
grant select, insert on public.validation_findings to authenticated;
