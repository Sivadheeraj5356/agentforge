-- Agent Work Environments (W1–W5). Packs stay org-scoped; adapter `work` is evaluator-only.

alter table public.environment_versions
  drop constraint if exists environment_versions_adapter_check;

alter table public.environment_versions
  add constraint environment_versions_adapter_check check (
    adapter_id in ('harbor', 'isolated', 'unsupported', 'work')
  );

alter table public.evaluation_runs
  add column if not exists eval_scenario_id uuid references public.eval_scenarios (id)
    on delete set null;

create index if not exists evaluation_runs_eval_scenario_id_idx
  on public.evaluation_runs (eval_scenario_id)
  where eval_scenario_id is not null;

insert into public.tasks (benchmark_version_id, external_key, name, description, metadata)
select
  bv.id,
  'production-incident-eu-payments',
  'EU payments incident',
  'Investigate intermittent EU payment failures and restore service without losing customer data.',
  '{"schemaVersion":1,"horizon":"long","domain":"incident","packKey":"production-incident-eu-payments"}'::jsonb
from public.benchmark_versions bv
inner join public.benchmarks b on b.id = bv.benchmark_id
where b.key = 'agentforge-internal'
  and bv.version = '1.0.0'
on conflict (benchmark_version_id, external_key) do nothing;

insert into public.task_versions (task_id, version)
select t.id, '1.0.0'
from public.tasks t
inner join public.benchmark_versions bv on bv.id = t.benchmark_version_id
inner join public.benchmarks b on b.id = bv.benchmark_id
where b.key = 'agentforge-internal'
  and t.external_key = 'production-incident-eu-payments'
on conflict (task_id, version) do nothing;
