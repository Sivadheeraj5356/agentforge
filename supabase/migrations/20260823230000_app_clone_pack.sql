-- Catalog task for the app-clone checkout console pack.

insert into public.tasks (benchmark_version_id, external_key, name, description, metadata)
select
  bv.id,
  'checkout-console-clone',
  'Checkout console clone',
  'Restore tax, complete a stuck checkout through cloned UI surfaces, issue a partial refund, and leave an audit note without wiping inventory.',
  '{"schemaVersion":1,"horizon":"long","domain":"app-clone","packKey":"checkout-console-clone"}'::jsonb
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
  and t.external_key = 'checkout-console-clone'
on conflict (task_id, version) do nothing;
