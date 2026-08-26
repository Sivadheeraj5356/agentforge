-- AgentForge reference + BYO harness agents. Held-out training prefers reference.

insert into public.agents (provider, name, version, type, metadata)
values
  (
    'agentforge',
    'reference',
    '1.0.0',
    'model',
    '{"schemaVersion":1,"kind":"agent","runtime":"isolated"}'::jsonb
  ),
  (
    'agentforge',
    'byo',
    '1.0.0',
    'harness',
    '{"schemaVersion":1,"kind":"byo"}'::jsonb
  )
on conflict (provider, name, version) do nothing;

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
  where a.provider = 'agentforge' and a.name = 'reference' and a.version = '1.0.0'
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
