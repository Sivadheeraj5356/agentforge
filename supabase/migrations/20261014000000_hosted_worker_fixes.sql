-- Hosted Supabase compatibility for the evaluator worker.
-- 1. Newer Postgres rejects the ambiguous `payload` reference in on_evaluation_run_terminal.
-- 2. service_role has no implicit table privileges on hosted projects; grant only what
--    services/evaluator/src/evaluator/store.py touches.

create or replace function public.on_evaluation_run_terminal(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  run public.evaluation_runs;
  event_name text;
  event_payload jsonb;
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

  select coalesce(r.payload, '{}'::jsonb) into event_payload
  from public.evaluation_results r
  where r.evaluation_run_id = run.id
  order by r.created_at desc
  limit 1;

  event_payload := coalesce(event_payload, '{}'::jsonb) || jsonb_build_object(
    'runId', run.id,
    'status', run.status
  );

  perform public.queue_webhook_deliveries(run.organization_id, event_name, event_payload);

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
$function$;

grant usage on schema public to service_role;

grant select on public.agents, public.tasks, public.task_versions, public.submissions,
  public.eval_scenarios to service_role;
grant select, update on public.evaluation_runs, public.evaluation_jobs to service_role;
grant select, insert on public.artifacts, public.evaluation_trials,
  public.evaluation_results, public.rollouts to service_role;
grant select, insert, update on public.webhook_deliveries to service_role;

grant execute on function public.claim_evaluation_job(text) to service_role;
grant execute on function public.heartbeat_evaluation_job(uuid, text) to service_role;
grant execute on function public.on_evaluation_run_terminal(uuid) to service_role;
grant select on public.webhook_endpoints to service_role;
