-- EvalForge 12–18: reporting, review, CI, private evals, rollouts, lab.
-- Control plane still never starts sandboxes. Service role writes scores.

-- ---------------------------------------------------------------------------
-- Slice B: trial provenance (cost/tokens stay null until the worker records them)
-- ---------------------------------------------------------------------------

alter table public.evaluation_trials
  add column if not exists model_provider text,
  add column if not exists model_id text,
  add column if not exists model_snapshot text,
  add column if not exists cost_usd numeric(12, 6),
  add column if not exists prompt_tokens integer,
  add column if not exists completion_tokens integer,
  add column if not exists latency_ms integer;

alter table public.evaluation_trials
  drop constraint if exists evaluation_trials_model_provider_length,
  drop constraint if exists evaluation_trials_model_id_length,
  drop constraint if exists evaluation_trials_model_snapshot_length,
  drop constraint if exists evaluation_trials_cost_non_negative,
  drop constraint if exists evaluation_trials_prompt_tokens_non_negative,
  drop constraint if exists evaluation_trials_completion_tokens_non_negative,
  drop constraint if exists evaluation_trials_latency_non_negative;

alter table public.evaluation_trials
  add constraint evaluation_trials_model_provider_length check (
    model_provider is null or char_length(model_provider) between 1 and 64
  ),
  add constraint evaluation_trials_model_id_length check (
    model_id is null or char_length(model_id) between 1 and 200
  ),
  add constraint evaluation_trials_model_snapshot_length check (
    model_snapshot is null or char_length(model_snapshot) between 1 and 200
  ),
  add constraint evaluation_trials_cost_non_negative check (
    cost_usd is null or cost_usd >= 0
  ),
  add constraint evaluation_trials_prompt_tokens_non_negative check (
    prompt_tokens is null or prompt_tokens >= 0
  ),
  add constraint evaluation_trials_completion_tokens_non_negative check (
    completion_tokens is null or completion_tokens >= 0
  ),
  add constraint evaluation_trials_latency_non_negative check (
    latency_ms is null or latency_ms >= 0
  );

alter table public.evaluation_runs
  add column if not exists agent_git_sha text,
  add column if not exists agent_config_hash text,
  add column if not exists suite_run_id uuid,
  add column if not exists environment_version_id uuid;

alter table public.evaluation_runs
  drop constraint if exists evaluation_runs_agent_git_sha_format,
  drop constraint if exists evaluation_runs_agent_config_hash_format;

alter table public.evaluation_runs
  add constraint evaluation_runs_agent_git_sha_format check (
    agent_git_sha is null or agent_git_sha ~ '^[a-f0-9]{7,40}$'
  ),
  add constraint evaluation_runs_agent_config_hash_format check (
    agent_config_hash is null or agent_config_hash ~ '^[a-f0-9]{64}$'
  );

-- ---------------------------------------------------------------------------
-- Slice C: workflow roles (separate from organization owner/admin/member)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workflow_role') then
    create type public.workflow_role as enum ('reviewer', 'adjudicator');
  end if;
  if not exists (select 1 from pg_type where typname = 'finding_review_decision') then
    create type public.finding_review_decision as enum ('accept', 'reject', 'comment');
  end if;
  if not exists (select 1 from pg_type where typname = 'privacy_class') then
    create type public.privacy_class as enum ('PRIVATE', 'INTERNAL', 'RESTRICTED');
  end if;
end
$$;

create table if not exists public.evaluation_workflow_memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  workflow_role public.workflow_role not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id, workflow_role)
);

create index if not exists evaluation_workflow_memberships_user_id_idx
  on public.evaluation_workflow_memberships (user_id);

create table if not exists public.finding_reviews (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id),
  round smallint not null default 1,
  decision public.finding_review_decision not null,
  rationale text not null,
  evidence jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint finding_reviews_round_check check (round in (1, 2)),
  constraint finding_reviews_rationale_length check (
    char_length(rationale) between 8 and 4000
  ),
  constraint finding_reviews_evidence_object check (jsonb_typeof(evidence) = 'object'),
  constraint finding_reviews_evidence_summary check (
    evidence ? 'summary' and char_length(coalesce(evidence ->> 'summary', '')) >= 8
  ),
  constraint finding_reviews_finding_reviewer_unique unique (finding_id, reviewer_id)
);

create index if not exists finding_reviews_finding_id_idx
  on public.finding_reviews (finding_id);
create index if not exists finding_reviews_organization_id_idx
  on public.finding_reviews (organization_id);

create or replace function public.finding_reviews_assign_round()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select coalesce(max(fr.round), 0) + 1
    into new.round
  from public.finding_reviews fr
  where fr.finding_id = new.finding_id;

  if new.round > 2 then
    raise exception 'finding already has two independent reviews'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists finding_reviews_assign_round on public.finding_reviews;
create trigger finding_reviews_assign_round
  before insert on public.finding_reviews
  for each row execute function public.finding_reviews_assign_round();

create or replace function public.audit_finding_review_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (
    actor_id,
    organization_id,
    action,
    metadata
  )
  values (
    new.reviewer_id,
    new.organization_id,
    'finding.reviewed',
    jsonb_build_object(
      'findingId', new.finding_id::text,
      'decision', new.decision::text,
      'round', new.round
    )
  );
  return new;
end;
$$;

drop trigger if exists finding_reviews_audit_insert on public.finding_reviews;
create trigger finding_reviews_audit_insert
  after insert on public.finding_reviews
  for each row execute function public.audit_finding_review_insert();

-- ---------------------------------------------------------------------------
-- Slice E: org concurrency, suites, gates, signed webhooks
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists eval_concurrency_limit integer not null default 4;

alter table public.organizations
  drop constraint if exists organizations_eval_concurrency_limit_range;

alter table public.organizations
  add constraint organizations_eval_concurrency_limit_range check (
    eval_concurrency_limit between 1 and 32
  );

create table if not exists public.evaluation_suites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint evaluation_suites_name_length check (
    char_length(name) between 1 and 120 and name = btrim(name)
  )
);

create index if not exists evaluation_suites_organization_id_idx
  on public.evaluation_suites (organization_id, created_at desc);

create table if not exists public.evaluation_suite_members (
  suite_id uuid not null references public.evaluation_suites (id) on delete cascade,
  task_version_id uuid not null references public.task_versions (id),
  ordinal integer not null,
  primary key (suite_id, task_version_id),
  constraint evaluation_suite_members_ordinal_positive check (ordinal >= 1)
);

create table if not exists public.evaluation_gates (
  id uuid primary key default gen_random_uuid(),
  suite_id uuid not null references public.evaluation_suites (id) on delete cascade,
  metric text not null,
  min_value numeric(6, 4) not null,
  created_at timestamptz not null default now(),
  constraint evaluation_gates_metric_check check (metric in ('pass_at_1', 'mean_reward')),
  constraint evaluation_gates_min_value_range check (min_value >= 0 and min_value <= 1)
);

create index if not exists evaluation_gates_suite_id_idx
  on public.evaluation_gates (suite_id);

create table if not exists public.evaluation_suite_runs (
  id uuid primary key default gen_random_uuid(),
  suite_id uuid not null references public.evaluation_suites (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null default 'queued',
  gate_passed boolean,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint evaluation_suite_runs_status_check check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  )
);

create index if not exists evaluation_suite_runs_organization_id_idx
  on public.evaluation_suite_runs (organization_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'evaluation_runs_suite_run_id_fkey'
  ) then
    alter table public.evaluation_runs
      add constraint evaluation_runs_suite_run_id_fkey
      foreign key (suite_run_id) references public.evaluation_suite_runs (id) on delete set null;
  end if;
end
$$;

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  url text not null,
  events text[] not null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint webhook_endpoints_url_length check (char_length(url) between 8 and 2048),
  constraint webhook_endpoints_url_scheme check (
    url ~ '^https://'
    or url like 'http://127.0.0.1%'
  ),
  constraint webhook_endpoints_events_nonempty check (cardinality(events) >= 1),
  constraint webhook_endpoints_events_known check (
    events <@ array['evaluation.completed', 'evaluation.failed', 'regression.detected']::text[]
  )
);

create index if not exists webhook_endpoints_organization_id_idx
  on public.webhook_endpoints (organization_id);

create table if not exists public.webhook_endpoint_secrets (
  endpoint_id uuid primary key references public.webhook_endpoints (id) on delete cascade,
  secret text not null,
  constraint webhook_endpoint_secrets_length check (char_length(secret) between 16 and 128)
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  signature text not null,
  status text not null default 'pending',
  last_error text,
  created_at timestamptz not null default now(),
  constraint webhook_deliveries_event_check check (
    event in ('evaluation.completed', 'evaluation.failed', 'regression.detected')
  ),
  constraint webhook_deliveries_status_check check (
    status in ('pending', 'delivered', 'failed')
  ),
  constraint webhook_deliveries_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint webhook_deliveries_signature_length check (char_length(signature) between 10 and 200),
  constraint webhook_deliveries_last_error_length check (
    last_error is null or char_length(last_error) <= 2000
  )
);

create index if not exists webhook_deliveries_pending_idx
  on public.webhook_deliveries (created_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Slice F: private scenarios
-- ---------------------------------------------------------------------------

create table if not exists public.eval_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  key text not null,
  name text not null,
  starting_state jsonb not null default '{}'::jsonb,
  request_text text not null,
  expected_outcome jsonb not null default '{}'::jsonb,
  verifier_pointer text,
  difficulty text not null,
  authoring_source text not null,
  trusted boolean not null default false,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint eval_scenarios_key_format check (
    key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(key) between 2 and 64
  ),
  constraint eval_scenarios_org_key_unique unique (organization_id, key),
  constraint eval_scenarios_name_length check (
    char_length(name) between 1 and 120 and name = btrim(name)
  ),
  constraint eval_scenarios_request_length check (
    char_length(request_text) between 1 and 8000
  ),
  constraint eval_scenarios_starting_state_object check (jsonb_typeof(starting_state) = 'object'),
  constraint eval_scenarios_expected_outcome_object check (jsonb_typeof(expected_outcome) = 'object'),
  constraint eval_scenarios_difficulty_check check (difficulty in ('easy', 'medium', 'hard')),
  constraint eval_scenarios_authoring_source_check check (
    authoring_source in ('human', 'ai_assisted')
  ),
  constraint eval_scenarios_verifier_pointer_length check (
    verifier_pointer is null or char_length(verifier_pointer) <= 512
  )
);

create index if not exists eval_scenarios_organization_id_idx
  on public.eval_scenarios (organization_id, created_at desc);

create or replace function public.eval_scenarios_protect_ai_trust()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
    and new.authoring_source = 'ai_assisted'
    and new.trusted is true then
    raise exception 'AI-assisted scenarios are not auto-trusted'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists eval_scenarios_protect_ai_trust on public.eval_scenarios;
create trigger eval_scenarios_protect_ai_trust
  before insert on public.eval_scenarios
  for each row execute function public.eval_scenarios_protect_ai_trust();

-- ---------------------------------------------------------------------------
-- Slice G: immutable environment versions + rollouts
-- ---------------------------------------------------------------------------

create table if not exists public.environment_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  adapter_id text not null,
  version text not null,
  spec jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint environment_versions_adapter_check check (
    adapter_id in ('harbor', 'isolated', 'unsupported')
  ),
  constraint environment_versions_version_format check (
    version ~ '^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*$'
    and char_length(version) between 1 and 64
    and lower(version) <> 'latest'
  ),
  constraint environment_versions_org_adapter_version_unique unique (
    organization_id, adapter_id, version
  ),
  constraint environment_versions_spec_object check (jsonb_typeof(spec) = 'object')
);

create index if not exists environment_versions_organization_id_idx
  on public.environment_versions (organization_id);

create or replace function public.environment_versions_protect_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.adapter_id is distinct from old.adapter_id
    or new.version is distinct from old.version
    or new.spec is distinct from old.spec then
    raise exception 'environment versions are immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists environment_versions_protect_immutable on public.environment_versions;
create trigger environment_versions_protect_immutable
  before update on public.environment_versions
  for each row execute function public.environment_versions_protect_immutable();

create table if not exists public.rollouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  environment_version_id uuid not null references public.environment_versions (id),
  task_version_id uuid not null references public.task_versions (id),
  agent_id uuid references public.agents (id),
  seed integer not null default 0,
  evaluation_run_id uuid references public.evaluation_runs (id) on delete set null,
  reward numeric(6, 4),
  created_at timestamptz not null default now(),
  constraint rollouts_seed_non_negative check (seed >= 0),
  constraint rollouts_reward_range check (reward is null or (reward >= 0 and reward <= 1))
);

create index if not exists rollouts_organization_id_idx
  on public.rollouts (organization_id, created_at desc);
create index if not exists rollouts_environment_version_id_idx
  on public.rollouts (environment_version_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'evaluation_runs_environment_version_id_fkey'
  ) then
    alter table public.evaluation_runs
      add constraint evaluation_runs_environment_version_id_fkey
      foreign key (environment_version_id) references public.environment_versions (id)
      on delete set null;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Slice H: dataset versions + privacy (PRIVATE default; never reusable customer data)
-- ---------------------------------------------------------------------------

create table if not exists public.dataset_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  version text not null,
  privacy_class public.privacy_class not null default 'PRIVATE',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint dataset_versions_name_length check (
    char_length(name) between 1 and 120 and name = btrim(name)
  ),
  constraint dataset_versions_version_format check (
    version ~ '^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*$'
    and char_length(version) between 1 and 64
    and lower(version) <> 'latest'
  ),
  constraint dataset_versions_org_name_version_unique unique (organization_id, name, version)
);

create index if not exists dataset_versions_organization_id_idx
  on public.dataset_versions (organization_id, created_at desc);

create or replace function public.dataset_versions_protect_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.name is distinct from old.name
    or new.version is distinct from old.version
    or new.privacy_class is distinct from old.privacy_class then
    raise exception 'dataset versions are immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists dataset_versions_protect_immutable on public.dataset_versions;
create trigger dataset_versions_protect_immutable
  before update on public.dataset_versions
  for each row execute function public.dataset_versions_protect_immutable();

create table if not exists public.dataset_members (
  id uuid primary key default gen_random_uuid(),
  dataset_version_id uuid not null references public.dataset_versions (id) on delete cascade,
  task_version_id uuid references public.task_versions (id),
  environment_version_id uuid references public.environment_versions (id),
  evaluation_run_id uuid references public.evaluation_runs (id) on delete set null,
  review_id uuid references public.reviews (id) on delete set null,
  constraint dataset_members_lineage check (
    task_version_id is not null
    or environment_version_id is not null
    or evaluation_run_id is not null
    or review_id is not null
  )
);

create index if not exists dataset_members_dataset_version_id_idx
  on public.dataset_members (dataset_version_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function app_private.has_workflow_role(
  p_organization_id uuid,
  p_role public.workflow_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.evaluation_workflow_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.workflow_role = p_role
  );
$$;

revoke all on function app_private.has_workflow_role(uuid, public.workflow_role) from public;
grant execute on function app_private.has_workflow_role(uuid, public.workflow_role) to authenticated;

create or replace function app_private.finding_review_org(p_finding_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.organization_id
  from public.findings f
  inner join public.reviews r on r.id = f.review_id
  where f.id = p_finding_id;
$$;

revoke all on function app_private.finding_review_org(uuid) from public;
grant execute on function app_private.finding_review_org(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Claim: respect org concurrency (no Kafka)
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

  perform public.reclaim_stale_evaluation_jobs(900);

  select j.*
    into job
  from public.evaluation_jobs j
  inner join public.organizations o on o.id = j.organization_id
  where j.status = 'queued'
    and j.available_at <= now()
    and (
      select count(*)::int
      from public.evaluation_jobs running
      where running.organization_id = j.organization_id
        and running.status in ('claimed', 'running')
    ) < o.eval_concurrency_limit
  order by j.created_at
  for update of j skip locked
  limit 1;

  if job.id is null then
    return null;
  end if;

  update public.evaluation_jobs
  set
    status = 'claimed',
    claimed_by = btrim(p_worker_id),
    claimed_at = now(),
    heartbeat_at = now(),
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
-- Held-out enqueue (training plane / service_role only)
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_held_out_evaluations(p_experiment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  experiment public.training_experiments;
  task_row record;
  agent_id uuid;
  run public.evaluation_runs;
  submission_id uuid;
  enqueued uuid[] := '{}';
  config jsonb;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select * into experiment
  from public.training_experiments
  where id = p_experiment_id;

  if experiment.id is null then
    raise exception 'training experiment not found'
      using errcode = 'P0002';
  end if;

  if experiment.project_id is null then
    raise exception 'training experiment has no project'
      using errcode = '23514';
  end if;

  select a.id into agent_id
  from public.agents a
  where a.provider = 'harbor' and a.name = 'terminus-2' and a.version = '1.0.0'
  limit 1;

  if agent_id is null then
    select a.id into agent_id
    from public.agents a
    where a.provider = 'agentforge' and a.name = 'oracle' and a.version = '1.0.0'
    limit 1;
  end if;

  for task_row in
    select tet.task_version_id, t.benchmark_version_id
    from public.training_experiment_tasks tet
    inner join public.task_versions tv on tv.id = tet.task_version_id
    inner join public.tasks t on t.id = tv.task_id
    where tet.experiment_id = experiment.id
      and tet.split = 'held_out'
  loop
    config := jsonb_build_object(
      'schemaVersion', 1,
      'agentKind', 'agent',
      'sandboxProvider', 'isolated',
      'attemptCount', 1,
      'rewardRecipe', experiment.reward_recipe,
      'heldOut', true,
      'experimentId', experiment.id::text
    );

    insert into public.submissions (project_id, kind, metadata, created_by)
    values (
      experiment.project_id,
      'internal_package',
      jsonb_build_object('schemaVersion', 1, 'source', 'held_out_training'),
      experiment.created_by
    )
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
      experiment.project_id,
      experiment.organization_id,
      submission_id,
      task_row.benchmark_version_id,
      task_row.task_version_id,
      agent_id,
      config,
      'queued'
    )
    returning * into run;

    insert into public.evaluation_jobs (evaluation_run_id, organization_id, status)
    values (run.id, experiment.organization_id, 'queued');

    enqueued := array_append(enqueued, run.id);
  end loop;

  return jsonb_build_object(
    'experimentId', experiment.id,
    'runIds', to_jsonb(enqueued),
    'count', coalesce(array_length(enqueued, 1), 0)
  );
end;
$$;

revoke all on function public.enqueue_held_out_evaluations(uuid) from public;
revoke all on function public.enqueue_held_out_evaluations(uuid) from anon;
revoke all on function public.enqueue_held_out_evaluations(uuid) from authenticated;
grant execute on function public.enqueue_held_out_evaluations(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Suites + webhooks + training metrics hook
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_evaluation_suite(
  p_suite_id uuid,
  p_project_id uuid,
  p_agent_id uuid,
  p_evaluator_configuration jsonb
)
returns public.evaluation_suite_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  suite public.evaluation_suites;
  org_id uuid;
  suite_run public.evaluation_suite_runs;
  member record;
  config jsonb;
  run public.evaluation_runs;
  submission_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select * into suite
  from public.evaluation_suites
  where id = p_suite_id;

  if suite.id is null then
    raise exception 'evaluation suite not found'
      using errcode = 'P0002';
  end if;

  if not app_private.is_organization_owner_or_admin(suite.organization_id) then
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

  if org_id is distinct from suite.organization_id then
    raise exception 'suite project is not in organization'
      using errcode = '23514';
  end if;

  config := coalesce(p_evaluator_configuration, '{"schemaVersion":1}'::jsonb);

  insert into public.evaluation_suite_runs (
    suite_id, organization_id, project_id, status, created_by
  )
  values (suite.id, org_id, p_project_id, 'queued', auth.uid())
  returning * into suite_run;

  for member in
    select
      m.task_version_id,
      t.benchmark_version_id
    from public.evaluation_suite_members m
    inner join public.task_versions tv on tv.id = m.task_version_id
    inner join public.tasks t on t.id = tv.task_id
    where m.suite_id = suite.id
    order by m.ordinal
  loop
    insert into public.submissions (project_id, kind, metadata, created_by)
    values (
      p_project_id,
      'internal_package',
      jsonb_build_object('schemaVersion', 1, 'source', 'evaluation_suite'),
      auth.uid()
    )
    returning id into submission_id;

    insert into public.evaluation_runs (
      project_id,
      organization_id,
      submission_id,
      benchmark_version_id,
      task_version_id,
      agent_id,
      evaluator_configuration,
      suite_run_id,
      status
    )
    values (
      p_project_id,
      org_id,
      submission_id,
      member.benchmark_version_id,
      member.task_version_id,
      p_agent_id,
      config,
      suite_run.id,
      'queued'
    )
    returning * into run;

    insert into public.evaluation_jobs (evaluation_run_id, organization_id, status)
    values (run.id, org_id, 'queued');
  end loop;

  return suite_run;
end;
$$;

revoke all on function public.enqueue_evaluation_suite(uuid, uuid, uuid, jsonb) from public;
revoke all on function public.enqueue_evaluation_suite(uuid, uuid, uuid, jsonb) from anon;
grant execute on function public.enqueue_evaluation_suite(uuid, uuid, uuid, jsonb) to authenticated;

create or replace function public.create_webhook_endpoint(
  p_organization_id uuid,
  p_url text,
  p_events text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  endpoint public.webhook_endpoints;
  secret text;
begin
  if auth.uid() is null then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if not app_private.is_organization_owner_or_admin(p_organization_id) then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  secret := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.webhook_endpoints (
    organization_id, url, events, created_by
  )
  values (p_organization_id, p_url, p_events, auth.uid())
  returning * into endpoint;

  insert into public.webhook_endpoint_secrets (endpoint_id, secret)
  values (endpoint.id, secret);

  insert into public.audit_events (
    actor_id, organization_id, action, metadata
  )
  values (
    auth.uid(),
    p_organization_id,
    'webhook.created',
    jsonb_build_object('endpointId', endpoint.id::text)
  );

  return jsonb_build_object('id', endpoint.id, 'secret', secret, 'url', endpoint.url);
end;
$$;

revoke all on function public.create_webhook_endpoint(uuid, text, text[]) from public;
revoke all on function public.create_webhook_endpoint(uuid, text, text[]) from anon;
grant execute on function public.create_webhook_endpoint(uuid, text, text[]) to authenticated;

create or replace function public.refresh_training_experiment_metrics(p_experiment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  avg_pass numeric;
  run_count integer;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select
    avg((r.payload ->> 'passAt1')::numeric),
    count(*)::int
  into avg_pass, run_count
  from public.evaluation_results r
  inner join public.evaluation_runs er on er.id = r.evaluation_run_id
  where er.evaluator_configuration ->> 'experimentId' = p_experiment_id::text
    and coalesce((er.evaluator_configuration ->> 'heldOut')::boolean, false);

  if run_count is null or run_count = 0 or avg_pass is null then
    return;
  end if;

  update public.training_experiments
  set metrics = jsonb_build_object(
    'held_out', jsonb_build_object(
      'passAt1', avg_pass,
      'runCount', run_count
    )
  )
  where id = p_experiment_id;
end;
$$;

revoke all on function public.refresh_training_experiment_metrics(uuid) from public;
revoke all on function public.refresh_training_experiment_metrics(uuid) from anon;
revoke all on function public.refresh_training_experiment_metrics(uuid) from authenticated;
grant execute on function public.refresh_training_experiment_metrics(uuid) to service_role;

create or replace function public.queue_webhook_deliveries(
  p_organization_id uuid,
  p_event text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  endpoint record;
  body jsonb;
  signature text;
begin
  body := coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
    'event', p_event,
    'occurredAt', now()
  );

  for endpoint in
    select e.id, e.organization_id, s.secret
    from public.webhook_endpoints e
    inner join public.webhook_endpoint_secrets s on s.endpoint_id = e.id
    where e.organization_id = p_organization_id
      and e.is_active
      and p_event = any (e.events)
  loop
    signature := 'sha256=' || encode(
      extensions.hmac(
        convert_to(body::text, 'UTF8'),
        convert_to(endpoint.secret, 'UTF8'),
        'sha256'
      ),
      'hex'
    );
    insert into public.webhook_deliveries (
      endpoint_id, organization_id, event, payload, signature, status
    )
    values (
      endpoint.id, endpoint.organization_id, p_event, body, signature, 'pending'
    );
  end loop;
end;
$$;

revoke all on function public.queue_webhook_deliveries(uuid, text, jsonb) from public;
revoke all on function public.queue_webhook_deliveries(uuid, text, jsonb) from anon;
revoke all on function public.queue_webhook_deliveries(uuid, text, jsonb) from authenticated;
grant execute on function public.queue_webhook_deliveries(uuid, text, jsonb) to service_role;

create or replace function public.on_evaluation_run_terminal(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.evaluation_runs;
  event_name text;
  payload jsonb;
  experiment_id text;
  remaining integer;
  failed_count integer;
  gate record;
  actual numeric;
  all_passed boolean := true;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  select * into run
  from public.evaluation_runs
  where id = p_run_id;

  if run.id is null then
    return;
  end if;

  event_name := case
    when run.status = 'failed' then 'evaluation.failed'
    else 'evaluation.completed'
  end;

  select coalesce(payload, '{}'::jsonb) into payload
  from public.evaluation_results
  where evaluation_run_id = run.id
  order by created_at desc
  limit 1;

  payload := coalesce(payload, '{}'::jsonb) || jsonb_build_object(
    'runId', run.id,
    'status', run.status
  );

  perform public.queue_webhook_deliveries(run.organization_id, event_name, payload);

  experiment_id := run.evaluator_configuration ->> 'experimentId';
  if experiment_id is not null then
    perform public.refresh_training_experiment_metrics(experiment_id::uuid);
  end if;

  if run.suite_run_id is null then
    return;
  end if;

  select count(*)::int into remaining
  from public.evaluation_runs
  where suite_run_id = run.suite_run_id
    and status in ('queued', 'running');

  if remaining > 0 then
    update public.evaluation_suite_runs
    set status = 'running'
    where id = run.suite_run_id and status = 'queued';
    return;
  end if;

  select count(*)::int into failed_count
  from public.evaluation_runs
  where suite_run_id = run.suite_run_id
    and status = 'failed';

  for gate in
    select g.*
    from public.evaluation_gates g
    inner join public.evaluation_suite_runs sr on sr.suite_id = g.suite_id
    where sr.id = run.suite_run_id
  loop
    select avg(
      case gate.metric
        when 'pass_at_1' then (er.payload ->> 'passAt1')::numeric
        else (er.payload ->> 'meanReward')::numeric
      end
    )
    into actual
    from public.evaluation_results er
    inner join public.evaluation_runs r on r.id = er.evaluation_run_id
    where r.suite_run_id = run.suite_run_id;

    if actual is null or actual < gate.min_value then
      all_passed := false;
    end if;
  end loop;

  update public.evaluation_suite_runs
  set
    status = case when failed_count > 0 or not all_passed then 'failed' else 'succeeded' end,
    gate_passed = all_passed and failed_count = 0,
    completed_at = now()
  where id = run.suite_run_id;

  if not all_passed or failed_count > 0 then
    perform public.queue_webhook_deliveries(
      run.organization_id,
      'regression.detected',
      jsonb_build_object('suiteRunId', run.suite_run_id, 'runId', run.id)
    );
  end if;
end;
$$;

revoke all on function public.on_evaluation_run_terminal(uuid) from public;
revoke all on function public.on_evaluation_run_terminal(uuid) from anon;
revoke all on function public.on_evaluation_run_terminal(uuid) from authenticated;
grant execute on function public.on_evaluation_run_terminal(uuid) to service_role;

grant select, insert, update on public.webhook_deliveries to service_role;
grant select on public.webhook_endpoints to service_role;
grant select on public.webhook_endpoint_secrets to service_role;
grant select, update on public.training_experiments to service_role;
grant select, update on public.evaluation_suite_runs to service_role;
grant select, insert on public.rollouts to service_role;
grant select on public.environment_versions to service_role;
grant select, insert on public.submissions to service_role;
grant select, insert on public.evaluation_jobs to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.evaluation_workflow_memberships enable row level security;
alter table public.evaluation_workflow_memberships force row level security;
alter table public.finding_reviews enable row level security;
alter table public.finding_reviews force row level security;
alter table public.evaluation_suites enable row level security;
alter table public.evaluation_suites force row level security;
alter table public.evaluation_suite_members enable row level security;
alter table public.evaluation_suite_members force row level security;
alter table public.evaluation_gates enable row level security;
alter table public.evaluation_gates force row level security;
alter table public.evaluation_suite_runs enable row level security;
alter table public.evaluation_suite_runs force row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_endpoints force row level security;
alter table public.webhook_endpoint_secrets enable row level security;
alter table public.webhook_endpoint_secrets force row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.webhook_deliveries force row level security;
alter table public.eval_scenarios enable row level security;
alter table public.eval_scenarios force row level security;
alter table public.environment_versions enable row level security;
alter table public.environment_versions force row level security;
alter table public.rollouts enable row level security;
alter table public.rollouts force row level security;
alter table public.dataset_versions enable row level security;
alter table public.dataset_versions force row level security;
alter table public.dataset_members enable row level security;
alter table public.dataset_members force row level security;

create policy evaluation_workflow_memberships_select_member
  on public.evaluation_workflow_memberships for select to authenticated
  using (app_private.is_organization_member(organization_id));

create policy evaluation_workflow_memberships_insert_owner_admin
  on public.evaluation_workflow_memberships for insert to authenticated
  with check (app_private.is_organization_owner_or_admin(organization_id));

create policy evaluation_workflow_memberships_delete_owner_admin
  on public.evaluation_workflow_memberships for delete to authenticated
  using (app_private.is_organization_owner_or_admin(organization_id));

create or replace function app_private.has_submitted_finding_review(p_finding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.finding_reviews fr
    where fr.finding_id = p_finding_id
      and fr.reviewer_id = (select auth.uid())
      and fr.submitted_at is not null
  );
$$;

revoke all on function app_private.has_submitted_finding_review(uuid) from public;
grant execute on function app_private.has_submitted_finding_review(uuid) to authenticated;

-- Independent review: a reviewer cannot read another reviewer's rationale
-- until they have submitted their own review for the same finding.
drop policy if exists finding_reviews_select_independent on public.finding_reviews;
create policy finding_reviews_select_independent
  on public.finding_reviews for select to authenticated
  using (
    reviewer_id = (select auth.uid())
    or (
      submitted_at is not null
      and app_private.has_submitted_finding_review(finding_id)
    )
    or app_private.has_workflow_role(organization_id, 'adjudicator')
  );

create policy finding_reviews_insert_reviewer
  on public.finding_reviews for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and app_private.has_workflow_role(organization_id, 'reviewer')
    and organization_id = app_private.finding_review_org(finding_id)
  );

create policy reviews_insert_reviewer
  on public.reviews for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and app_private.has_workflow_role(organization_id, 'reviewer')
    and app_private.is_organization_member(organization_id)
  );

create policy findings_insert_reviewer
  on public.findings for insert to authenticated
  with check (
    exists (
      select 1
      from public.reviews r
      where r.id = review_id
        and (
          app_private.has_workflow_role(r.organization_id, 'reviewer')
          or app_private.is_organization_owner_or_admin(r.organization_id)
        )
    )
  );

create policy findings_update_adjudicator
  on public.findings for update to authenticated
  using (
    exists (
      select 1
      from public.reviews r
      where r.id = review_id
        and app_private.has_workflow_role(r.organization_id, 'adjudicator')
    )
  )
  with check (
    exists (
      select 1
      from public.reviews r
      where r.id = review_id
        and app_private.has_workflow_role(r.organization_id, 'adjudicator')
    )
  );

create policy evaluation_suites_select_member
  on public.evaluation_suites for select to authenticated
  using (app_private.is_organization_member(organization_id));

create policy evaluation_suites_insert_owner_admin
  on public.evaluation_suites for insert to authenticated
  with check (
    app_private.is_organization_owner_or_admin(organization_id)
    and created_by = (select auth.uid())
  );

create policy evaluation_suite_members_select_member
  on public.evaluation_suite_members for select to authenticated
  using (
    exists (
      select 1 from public.evaluation_suites s
      where s.id = suite_id and app_private.is_organization_member(s.organization_id)
    )
  );

create policy evaluation_suite_members_insert_owner_admin
  on public.evaluation_suite_members for insert to authenticated
  with check (
    exists (
      select 1 from public.evaluation_suites s
      where s.id = suite_id and app_private.is_organization_owner_or_admin(s.organization_id)
    )
  );

create policy evaluation_gates_select_member
  on public.evaluation_gates for select to authenticated
  using (
    exists (
      select 1 from public.evaluation_suites s
      where s.id = suite_id and app_private.is_organization_member(s.organization_id)
    )
  );

create policy evaluation_gates_insert_owner_admin
  on public.evaluation_gates for insert to authenticated
  with check (
    exists (
      select 1 from public.evaluation_suites s
      where s.id = suite_id and app_private.is_organization_owner_or_admin(s.organization_id)
    )
  );

create policy evaluation_suite_runs_select_member
  on public.evaluation_suite_runs for select to authenticated
  using (app_private.is_organization_member(organization_id));

create policy webhook_endpoints_select_member
  on public.webhook_endpoints for select to authenticated
  using (app_private.is_organization_member(organization_id));

-- Secrets are never granted to authenticated. Service role only.

create policy webhook_deliveries_select_owner_admin
  on public.webhook_deliveries for select to authenticated
  using (app_private.is_organization_owner_or_admin(organization_id));

create policy eval_scenarios_select_member
  on public.eval_scenarios for select to authenticated
  using (app_private.is_organization_member(organization_id));

create policy eval_scenarios_insert_owner_admin
  on public.eval_scenarios for insert to authenticated
  with check (
    app_private.is_organization_owner_or_admin(organization_id)
    and created_by = (select auth.uid())
    and (authoring_source = 'human' or trusted = false)
  );

create policy eval_scenarios_update_trust
  on public.eval_scenarios for update to authenticated
  using (
    app_private.is_organization_owner_or_admin(organization_id)
    or app_private.has_workflow_role(organization_id, 'adjudicator')
  )
  with check (
    app_private.is_organization_owner_or_admin(organization_id)
    or app_private.has_workflow_role(organization_id, 'adjudicator')
  );

create policy environment_versions_select_member
  on public.environment_versions for select to authenticated
  using (app_private.is_organization_member(organization_id));

create policy environment_versions_insert_owner_admin
  on public.environment_versions for insert to authenticated
  with check (app_private.is_organization_owner_or_admin(organization_id));

create policy rollouts_select_member
  on public.rollouts for select to authenticated
  using (app_private.is_organization_member(organization_id));

create policy rollouts_insert_owner_admin
  on public.rollouts for insert to authenticated
  with check (app_private.is_organization_owner_or_admin(organization_id));

create policy dataset_versions_select_member
  on public.dataset_versions for select to authenticated
  using (app_private.is_organization_member(organization_id));

create policy dataset_versions_insert_owner_admin
  on public.dataset_versions for insert to authenticated
  with check (
    app_private.is_organization_owner_or_admin(organization_id)
    and created_by = (select auth.uid())
  );

create policy dataset_members_select_member
  on public.dataset_members for select to authenticated
  using (
    exists (
      select 1 from public.dataset_versions d
      where d.id = dataset_version_id
        and app_private.is_organization_member(d.organization_id)
    )
  );

create policy dataset_members_insert_owner_admin
  on public.dataset_members for insert to authenticated
  with check (
    exists (
      select 1 from public.dataset_versions d
      where d.id = dataset_version_id
        and app_private.is_organization_owner_or_admin(d.organization_id)
    )
  );

grant select, insert, delete on public.evaluation_workflow_memberships to authenticated;
grant select, insert on public.finding_reviews to authenticated;
grant select, insert on public.evaluation_suites to authenticated;
grant select, insert on public.evaluation_suite_members to authenticated;
grant select, insert on public.evaluation_gates to authenticated;
grant select, insert on public.evaluation_suite_runs to authenticated;
grant select on public.webhook_endpoints to authenticated;
grant select on public.webhook_deliveries to authenticated;
grant select, insert, update on public.eval_scenarios to authenticated;
grant select, insert on public.environment_versions to authenticated;
grant select, insert on public.rollouts to authenticated;
grant select, insert on public.dataset_versions to authenticated;
grant select, insert on public.dataset_members to authenticated;
