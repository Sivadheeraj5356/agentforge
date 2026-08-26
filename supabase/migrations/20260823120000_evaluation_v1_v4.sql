-- Chunks 12–16: Harbor Terminus-2 catalog, job lease heartbeats, ablation stage.
-- Control plane still never starts containers. Service role claims/heartbeats only.

-- ---------------------------------------------------------------------------
-- Job lease (horizontal workers; reclaim crashed claims)
-- ---------------------------------------------------------------------------

alter table public.evaluation_jobs
  add column if not exists heartbeat_at timestamptz;

create index if not exists evaluation_jobs_stale_lease_idx
  on public.evaluation_jobs (heartbeat_at)
  where status in ('claimed', 'running');

create or replace function public.reclaim_stale_evaluation_jobs(p_lease_seconds integer default 900)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reclaimed integer;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not authorized'
      using errcode = '42501';
  end if;

  if p_lease_seconds is null or p_lease_seconds < 60 or p_lease_seconds > 86400 then
    raise exception 'lease seconds out of range'
      using errcode = '23514';
  end if;

  update public.evaluation_jobs
  set
    status = 'queued',
    claimed_by = null,
    claimed_at = null,
    heartbeat_at = null,
    last_error = 'lease expired; requeued'
  where status in ('claimed', 'running')
    and (
      (heartbeat_at is not null and heartbeat_at < now() - make_interval(secs => p_lease_seconds))
      or (heartbeat_at is null and claimed_at is not null and claimed_at < now() - make_interval(secs => p_lease_seconds))
    );

  get diagnostics reclaimed = row_count;
  return reclaimed;
end;
$$;

revoke all on function public.reclaim_stale_evaluation_jobs(integer) from public;
revoke all on function public.reclaim_stale_evaluation_jobs(integer) from anon;
revoke all on function public.reclaim_stale_evaluation_jobs(integer) from authenticated;
grant execute on function public.reclaim_stale_evaluation_jobs(integer) to service_role;

create or replace function public.heartbeat_evaluation_job(p_job_id uuid, p_worker_id text)
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

  update public.evaluation_jobs
  set heartbeat_at = now()
  where id = p_job_id
    and claimed_by = btrim(p_worker_id)
    and status in ('claimed', 'running')
  returning * into job;

  if job.id is null then
    raise exception 'evaluation job heartbeat rejected'
      using errcode = 'P0002';
  end if;

  return job;
end;
$$;

revoke all on function public.heartbeat_evaluation_job(uuid, text) from public;
revoke all on function public.heartbeat_evaluation_job(uuid, text) from anon;
revoke all on function public.heartbeat_evaluation_job(uuid, text) from authenticated;
grant execute on function public.heartbeat_evaluation_job(uuid, text) to service_role;

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
    heartbeat_at = now(),
    attempt_count = evaluation_jobs.attempt_count + 1
  where id = job.id
  returning * into job;

  return job;
end;
$$;

-- ---------------------------------------------------------------------------
-- Training experiment stage: ablation records (still no training in Next.js)
-- ---------------------------------------------------------------------------

alter table public.training_experiments
  drop constraint if exists training_experiments_stage_check;

alter table public.training_experiments
  add constraint training_experiments_stage_check check (
    stage in ('base', 'sft', 'grpo', 'ablation')
  );

-- ---------------------------------------------------------------------------
-- Catalog: Terminus-2 + multi-agent harness (metadata only)
-- ---------------------------------------------------------------------------

insert into public.agents (provider, name, version, type, metadata)
values
  (
    'harbor',
    'terminus-2',
    '1.0.0',
    'model',
    '{"schemaVersion":1,"kind":"agent","runtime":"harbor"}'::jsonb
  ),
  (
    'vortex',
    'multi-agent',
    '1.0.0',
    'composite',
    '{"schemaVersion":1,"kind":"multi_agent","roles":["planner","coder","tester","reviewer"]}'::jsonb
  )
on conflict (provider, name, version) do nothing;
