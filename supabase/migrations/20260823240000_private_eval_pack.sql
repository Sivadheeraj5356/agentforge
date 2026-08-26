-- Catalog task for the private long-horizon eval pack.

insert into public.tasks (benchmark_version_id, external_key, name, description, metadata)
select
  bv.id,
  'private-eval-long-horizon',
  'Private eval — stalled release train',
  'Finish triage, repair, and handoff sessions in order on a stalled release train. Hidden stages score a private RLVR loop. Fable 5 is a design target, not a published score.',
  '{"schemaVersion":1,"horizon":"long","domain":"private-eval","packKey":"private-eval-long-horizon"}'::jsonb
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
  and t.external_key = 'private-eval-long-horizon'
on conflict (task_id, version) do nothing;
