-- Chunk 8–11: evaluation execution plane.
-- Control plane enqueues; the evaluator worker (service_role) claims and writes results.
-- Next.js never starts containers or runs task scripts.

-- ---------------------------------------------------------------------------
-- Columns on evaluation_runs
-- ---------------------------------------------------------------------------

alter table public.evaluation_runs
  add column if not exists run_number integer,
  add column if not exists organization_id uuid references public.organizations (id);

update public.evaluation_runs er
set organization_id = p.organization_id
from public.projects p
where p.id = er.project_id
  and er.organization_id is null;

alter table public.evaluation_runs
  alter column organization_id set not null;

create or replace function public.evaluation_runs_assign_run_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select coalesce(max(er.run_number), 0) + 1
    into new.run_number
  from public.evaluation_runs er
  where er.project_id = new.project_id;
  return new;
end;
$$;

drop trigger if exists evaluation_runs_assign_run_number on public.evaluation_runs;
create trigger evaluation_runs_assign_run_number
  before insert on public.evaluation_runs
  for each row
  when (new.run_number is null)
  execute function public.evaluation_runs_assign_run_number();

update public.evaluation_runs er
set run_number = ranked.position
from (
  select id, row_number() over (partition by project_id order by created_at, id) as position
  from public.evaluation_runs
) ranked
where ranked.id = er.id
  and er.run_number is null;

alter table public.evaluation_runs
  alter column run_number set not null,
  add constraint evaluation_runs_run_number_positive check (run_number >= 1),
  add constraint evaluation_runs_project_id_run_number_unique unique (project_id, run_number);

create or replace function public.evaluation_runs_protect_run_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.run_number is distinct from old.run_number then
    raise exception 'evaluation run_number is immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists evaluation_runs_protect_run_number on public.evaluation_runs;
create trigger evaluation_runs_protect_run_number
  before update on public.evaluation_runs
  for each row execute function public.evaluation_runs_protect_run_number();

create or replace function public.evaluation_runs_fill_organization()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select p.organization_id into new.organization_id
  from public.projects p
  where p.id = new.project_id;
  return new;
end;
$$;

drop trigger if exists evaluation_runs_fill_organization on public.evaluation_runs;
create trigger evaluation_runs_fill_organization
  before insert on public.evaluation_runs
  for each row
  when (new.organization_id is null)
  execute function public.evaluation_runs_fill_organization();

-- ---------------------------------------------------------------------------
-- Jobs (DB-backed queue; SKIP LOCKED claim)
-- ---------------------------------------------------------------------------

create table public.evaluation_jobs (
  id uuid primary key default gen_random_uuid(),
  evaluation_run_id uuid not null unique
    references public.evaluation_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  status text not null default 'queued',
  claimed_by text,
  claimed_at timestamptz,
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_jobs_status_check check (
    status in ('queued', 'claimed', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  constraint evaluation_jobs_attempt_count_non_negative check (attempt_count >= 0),
  constraint evaluation_jobs_attempt_count_max check (attempt_count <= 32),
  constraint evaluation_jobs_claimed_by_length check (
    claimed_by is null or char_length(claimed_by) between 1 and 128
  ),
  constraint evaluation_jobs_last_error_length check (
    last_error is null or char_length(last_error) <= 2000
  ),
  constraint evaluation_jobs_claim_shape check (
    (status = 'queued' and claimed_by is null and claimed_at is null)
    or (status in ('claimed', 'running') and claimed_by is not null)
    or (status in ('succeeded', 'failed', 'cancelled'))
  )
);

create index evaluation_jobs_queued_idx
  on public.evaluation_jobs (available_at, created_at)
  where status = 'queued';

create index evaluation_jobs_organization_id_idx
  on public.evaluation_jobs (organization_id);

create index evaluation_runs_organization_id_idx
  on public.evaluation_runs (organization_id);

create trigger evaluation_jobs_set_updated_at
  before update on public.evaluation_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Trials (pass@k attempts)
-- ---------------------------------------------------------------------------

create table public.evaluation_trials (
  id uuid primary key default gen_random_uuid(),
  evaluation_run_id uuid not null
    references public.evaluation_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  attempt_index integer not null,
  status text not null default 'queued',
  reward numeric(6, 4),
  metrics jsonb not null default '{}'::jsonb,
  failure_category text,
  trajectory_artifact_id uuid references public.artifacts (id) on delete set null,
  log_artifact_id uuid references public.artifacts (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint evaluation_trials_attempt_index_positive check (attempt_index >= 1),
  constraint evaluation_trials_attempt_index_max check (attempt_index <= 8),
  constraint evaluation_trials_run_attempt_unique unique (evaluation_run_id, attempt_index),
  constraint evaluation_trials_status_check check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  constraint evaluation_trials_reward_range check (
    reward is null or (reward >= 0 and reward <= 1)
  ),
  constraint evaluation_trials_metrics_object check (jsonb_typeof(metrics) = 'object'),
  constraint evaluation_trials_metrics_size check (octet_length(metrics::text) <= 16384),
  constraint evaluation_trials_failure_category_check check (
    failure_category is null
    or failure_category in (
      'planning',
      'tool_selection',
      'code_understanding',
      'environment_navigation',
      'verification',
      'recovery',
      'hallucinated_assumption',
      'timeout',
      'destructive_action',
      'none'
    )
  )
);

create index evaluation_trials_run_id_idx
  on public.evaluation_trials (evaluation_run_id, attempt_index);
create index evaluation_trials_organization_id_idx
  on public.evaluation_trials (organization_id);

-- ---------------------------------------------------------------------------
-- Training experiments (Chunk 11 records; no training in the control plane)
-- ---------------------------------------------------------------------------

create table public.training_experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  name text not null,
  stage text not null,
  parent_experiment_id uuid references public.training_experiments (id) on delete set null,
  reward_recipe text not null default 'binary',
  split_seed integer not null default 1,
  train_task_count integer not null default 0,
  held_out_task_count integer not null default 0,
  status text not null default 'planned',
  metrics jsonb not null default '{}'::jsonb,
  checkpoint_ref text,
  git_sha text,
  notes text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint training_experiments_name_length check (
    char_length(name) between 1 and 120 and name = btrim(name)
  ),
  constraint training_experiments_stage_check check (
    stage in ('base', 'sft', 'grpo')
  ),
  constraint training_experiments_reward_recipe_check check (
    reward_recipe in ('binary', 'continuous', 'hybrid')
  ),
  constraint training_experiments_status_check check (
    status in ('planned', 'running', 'succeeded', 'failed')
  ),
  constraint training_experiments_counts_non_negative check (
    train_task_count >= 0 and held_out_task_count >= 0
  ),
  constraint training_experiments_metrics_object check (jsonb_typeof(metrics) = 'object'),
  constraint training_experiments_metrics_size check (octet_length(metrics::text) <= 16384),
  constraint training_experiments_checkpoint_ref_length check (
    checkpoint_ref is null or char_length(checkpoint_ref) <= 512
  ),
  constraint training_experiments_git_sha_format check (
    git_sha is null or git_sha ~ '^[a-f0-9]{7,40}$'
  ),
  constraint training_experiments_notes_length check (
    notes is null or char_length(notes) <= 2000
  )
);

create index training_experiments_organization_id_created_at_idx
  on public.training_experiments (organization_id, created_at desc);
create index training_experiments_project_id_idx
  on public.training_experiments (project_id);

create table public.training_experiment_tasks (
  experiment_id uuid not null
    references public.training_experiments (id) on delete cascade,
  task_version_id uuid not null references public.task_versions (id),
  split text not null,
  primary key (experiment_id, task_version_id),
  constraint training_experiment_tasks_split_check check (split in ('train', 'held_out'))
);

-- ---------------------------------------------------------------------------
-- Organization scope helpers
-- ---------------------------------------------------------------------------

create or replace function app_private.is_evaluation_job_organization_member(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.evaluation_jobs j
    where j.id = p_job_id
      and app_private.is_organization_member(j.organization_id)
  );
$$;

revoke all on function app_private.is_evaluation_job_organization_member(uuid) from public;
grant execute on function app_private.is_evaluation_job_organization_member(uuid) to authenticated;

create or replace function app_private.is_evaluation_trial_organization_member(p_trial_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.evaluation_trials t
    where t.id = p_trial_id
      and app_private.is_organization_member(t.organization_id)
  );
$$;

revoke all on function app_private.is_evaluation_trial_organization_member(uuid) from public;
grant execute on function app_private.is_evaluation_trial_organization_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Claim job (service_role only). SKIP LOCKED so concurrent workers do not collide.
-- ---------------------------------------------------------------------------

create or replace function public.claim_evaluation_job(p_worker_id text)
returns public.evaluation_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.evaluation_jobs;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if p_worker_id is null or char_length(btrim(p_worker_id)) < 1 then
    raise exception 'worker id required'
      using errcode = '23514';
  end if;

  select *
    into job
  from public.evaluation_jobs
  where status = 'queued'
    and available_at <= now()
  order by created_at
  for update skip locked
  limit 1;

  if job.id is null then
    return null;
  end if;

  update public.evaluation_jobs
  set
    status = 'claimed',
    claimed_by = btrim(p_worker_id),
    claimed_at = now(),
    attempt_count = evaluation_jobs.attempt_count + 1
  where id = job.id
  returning * into job;

  return job;
end;
$$;

revoke all on function public.claim_evaluation_job(text) from public;
revoke all on function public.claim_evaluation_job(text) from anon;
revoke all on function public.claim_evaluation_job(text) from authenticated;
grant execute on function public.claim_evaluation_job(text) to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.evaluation_jobs enable row level security;
alter table public.evaluation_jobs force row level security;
alter table public.evaluation_trials enable row level security;
alter table public.evaluation_trials force row level security;
alter table public.training_experiments enable row level security;
alter table public.training_experiments force row level security;
alter table public.training_experiment_tasks enable row level security;
alter table public.training_experiment_tasks force row level security;

create policy evaluation_jobs_select_member
  on public.evaluation_jobs for select to authenticated
  using (app_private.is_organization_member(organization_id));

create policy evaluation_jobs_insert_owner_admin
  on public.evaluation_jobs for insert to authenticated
  with check (
    app_private.is_organization_owner_or_admin(organization_id)
    and status = 'queued'
    and claimed_by is null
  );

create policy evaluation_trials_select_member
  on public.evaluation_trials for select to authenticated
  using (app_private.is_organization_member(organization_id));

-- Trial writes are worker-only (service_role bypasses RLS).

create policy training_experiments_select_member
  on public.training_experiments for select to authenticated
  using (app_private.is_organization_member(organization_id));

create policy training_experiments_insert_owner_admin
  on public.training_experiments for insert to authenticated
  with check (
    app_private.is_organization_owner_or_admin(organization_id)
    and created_by = (select auth.uid())
  );

create policy training_experiments_update_owner_admin
  on public.training_experiments for update to authenticated
  using (app_private.is_organization_owner_or_admin(organization_id))
  with check (app_private.is_organization_owner_or_admin(organization_id));

create policy training_experiment_tasks_select_member
  on public.training_experiment_tasks for select to authenticated
  using (
    exists (
      select 1
      from public.training_experiments e
      where e.id = experiment_id
        and app_private.is_organization_member(e.organization_id)
    )
  );

create policy training_experiment_tasks_insert_owner_admin
  on public.training_experiment_tasks for insert to authenticated
  with check (
    exists (
      select 1
      from public.training_experiments e
      where e.id = experiment_id
        and app_private.is_organization_owner_or_admin(e.organization_id)
    )
  );

grant select, insert on public.evaluation_jobs to authenticated;
grant select on public.evaluation_trials to authenticated;
grant select, insert, update on public.training_experiments to authenticated;
grant select, insert on public.training_experiment_tasks to authenticated;

-- Users may enqueue queued runs; they must not mark them succeeded.
drop policy if exists evaluation_runs_update_owner_admin on public.evaluation_runs;

create policy evaluation_runs_cancel_owner_admin
  on public.evaluation_runs for update to authenticated
  using (
    app_private.is_project_organization_owner_or_admin(project_id)
    and status in ('queued', 'running')
  )
  with check (
    app_private.is_project_organization_owner_or_admin(project_id)
    and status = 'cancelled'
  );

-- ---------------------------------------------------------------------------
-- Catalog seed: public agents + benchmarks (table owner; not client-writable)
-- ---------------------------------------------------------------------------

insert into public.agents (provider, name, version, type, metadata)
values
  (
    'vortex',
    'oracle',
    '1.0.0',
    'harness',
    '{"schemaVersion":1,"kind":"oracle"}'::jsonb
  ),
  (
    'vortex',
    'nop',
    '1.0.0',
    'harness',
    '{"schemaVersion":1,"kind":"nop"}'::jsonb
  )
on conflict (provider, name, version) do nothing;

insert into public.benchmarks (key, name, description, provider, status)
values
  (
    'vortex-internal',
    'Vortex internal suite',
    'Original long-horizon fixtures owned by Vortex. Not Terminal Bench.',
    'vortex',
    'published'
  ),
  (
    'terminal-bench',
    'Terminal Bench',
    'Pinned Terminal Bench / Harbor task corpus. Import local fixtures; do not vendor licensed dumps.',
    'harbor',
    'published'
  )
on conflict (key) do nothing;

insert into public.benchmark_versions (benchmark_id, version, manifest)
select b.id, v.version, v.manifest
from public.benchmarks b
inner join (
  values
    (
      'vortex-internal',
      '1.0.0',
      '{"schemaVersion":1,"adapterHint":"terminus","summary":"Vortex original SWE/DevOps fixtures"}'::jsonb
    ),
    (
      'terminal-bench',
      '2.0.0',
      '{"schemaVersion":1,"adapterHint":"terminal-bench","summary":"Terminal Bench 2 pin"}'::jsonb
    )
) as v(key, version, manifest) on v.key = b.key
on conflict (benchmark_id, version) do nothing;

insert into public.tasks (benchmark_version_id, external_key, name, description, metadata)
select
  bv.id,
  t.external_key,
  t.name,
  t.description,
  '{"schemaVersion":1,"horizon":"long","domain":"api"}'::jsonb
from public.benchmark_versions bv
inner join public.benchmarks b on b.id = bv.benchmark_id
inner join (
  values
    ('broken-orders-api', 'Broken production API', 'Diagnose 500s on GET /orders without changing the API contract.'),
    ('broken-orders-filter', 'Broken order filter', 'Fix status filter crashes on GET /orders.'),
    ('healthcheck-missing', 'Missing healthcheck', 'Restore GET /health.'),
    ('contract-extra-field', 'Leaked debug field', 'Remove leaked debug field from GET /orders.'),
    ('silent-wrong-total', 'Silent wrong total', 'Correct order totals that fail silently.'),
    ('empty-orders-crash', 'Empty store crash', 'Empty store should return [] not 500.'),
    ('forbidden-test-rewrite', 'Forbidden test rewrite', 'Rewriting tests must not yield reward 1.'),
    ('stale-health-payload', 'Stale health payload', 'Restore the health payload contract.')
) as t(external_key, name, description) on true
where b.key = 'vortex-internal'
  and bv.version = '1.0.0'
on conflict (benchmark_version_id, external_key) do nothing;

insert into public.task_versions (task_id, version)
select t.id, '1.0.0'
from public.tasks t
inner join public.benchmark_versions bv on bv.id = t.benchmark_version_id
inner join public.benchmarks b on b.id = bv.benchmark_id
where b.key = 'vortex-internal'
on conflict (task_id, version) do nothing;

-- ---------------------------------------------------------------------------
-- Atomic enqueue (control plane). Worker never called from Next.js.
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_evaluation(
  p_project_id uuid,
  p_kind public.submission_kind,
  p_metadata jsonb,
  p_benchmark_version_id uuid,
  p_task_version_id uuid,
  p_agent_id uuid,
  p_evaluator_configuration jsonb
)
returns public.evaluation_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.evaluation_runs;
  submission_id uuid;
  org_id uuid;
  config jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if not app_private.is_project_organization_owner_or_admin(p_project_id) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select p.organization_id into org_id
  from public.projects p
  where p.id = p_project_id;

  if org_id is null then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  if p_kind is distinct from 'internal_package'
     and p_kind is distinct from 'benchmark_provided' then
    raise exception 'unsupported submission kind'
      using errcode = '23514';
  end if;

  config := coalesce(p_evaluator_configuration, '{"schemaVersion":1}'::jsonb);
  if jsonb_typeof(config) is distinct from 'object' then
    raise exception 'evaluator configuration must be an object'
      using errcode = '23514';
  end if;

  insert into public.submissions (project_id, kind, metadata, created_by)
  values (p_project_id, p_kind, coalesce(p_metadata, '{}'::jsonb), auth.uid())
  returning id into submission_id;

  insert into public.evaluation_runs (
    project_id,
    organization_id,
    submission_id,
    benchmark_version_id,
    task_version_id,
    agent_id,
    evaluator_configuration,
    status
  )
  values (
    p_project_id,
    org_id,
    submission_id,
    p_benchmark_version_id,
    p_task_version_id,
    p_agent_id,
    config,
    'queued'
  )
  returning * into run;

  insert into public.evaluation_jobs (evaluation_run_id, organization_id, status)
  values (run.id, org_id, 'queued');

  return run;
end;
$$;

revoke all on function public.enqueue_evaluation(
  uuid, public.submission_kind, jsonb, uuid, uuid, uuid, jsonb
) from public;
revoke all on function public.enqueue_evaluation(
  uuid, public.submission_kind, jsonb, uuid, uuid, uuid, jsonb
) from anon;
grant execute on function public.enqueue_evaluation(
  uuid, public.submission_kind, jsonb, uuid, uuid, uuid, jsonb
) to authenticated;

create or replace function public.cancel_evaluation_run(p_run_id uuid)
returns public.evaluation_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.evaluation_runs;
begin
  if auth.uid() is null then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select * into run
  from public.evaluation_runs
  where id = p_run_id;

  if run.id is null then
    raise exception 'evaluation run not found'
      using errcode = 'P0002';
  end if;

  if not app_private.is_project_organization_owner_or_admin(run.project_id) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if run.status not in ('queued', 'running') then
    raise exception 'evaluation run cannot be cancelled'
      using errcode = '23514';
  end if;

  update public.evaluation_runs
  set
    status = 'cancelled',
    completed_at = now()
  where id = run.id
  returning * into run;

  update public.evaluation_jobs
  set
    status = 'cancelled',
    last_error = 'cancelled by user'
  where evaluation_run_id = run.id
    and status in ('queued', 'claimed', 'running');

  return run;
end;
$$;

revoke all on function public.cancel_evaluation_run(uuid) from public;
revoke all on function public.cancel_evaluation_run(uuid) from anon;
grant execute on function public.cancel_evaluation_run(uuid) to authenticated;

grant select, insert, update on public.evaluation_jobs to service_role;
grant select, insert, update on public.evaluation_trials to service_role;
grant select, insert, update on public.evaluation_runs to service_role;
grant select, insert on public.evaluation_results to service_role;
grant select, insert on public.artifacts to service_role;
grant select on public.agents to service_role;
grant select on public.tasks to service_role;
grant insert on public.tasks to service_role;
grant select on public.task_versions to service_role;
grant insert on public.task_versions to service_role;
grant select on public.submissions to service_role;
grant select, insert, update on public.training_experiments to service_role;
grant select, insert on public.training_experiment_tasks to service_role;
