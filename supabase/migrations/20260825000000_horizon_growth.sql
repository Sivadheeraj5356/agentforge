-- Horizon catalog growth: original Isolated jobs + work packs. No SWE-bench dumps.

insert into public.tasks (benchmark_version_id, external_key, name, description, metadata)
select
  bv.id,
  payload.external_key,
  payload.name,
  payload.description,
  payload.metadata::jsonb
from public.benchmark_versions bv
inner join public.benchmarks b on b.id = bv.benchmark_id
cross join (
  values
    (
      'refund-double-apply',
      'Refund double-apply',
      'A refund helper debit is applied twice. Original Isolated fixture.',
      '{"schemaVersion":1,"horizon":"t1","domain":"horizon-swe","sandbox":"isolated"}'
    ),
    (
      'timezone-cutoff-orders',
      'Timezone cutoff orders',
      'Business-day cutoff must use UTC, not naive local time. Original Isolated fixture.',
      '{"schemaVersion":1,"horizon":"t1","domain":"horizon-swe","sandbox":"isolated"}'
    ),
    (
      'webhook-retry-storm',
      'Webhook retry storm',
      'Retries reuse delivery_id; ingest must be idempotent. Original Isolated fixture.',
      '{"schemaVersion":1,"horizon":"t1","domain":"horizon-swe","sandbox":"isolated"}'
    ),
    (
      'migration-partial-rows',
      'Migration partial rows',
      'A migrator stamps only the first legacy row. Original Isolated fixture.',
      '{"schemaVersion":1,"horizon":"t1","domain":"horizon-swe","sandbox":"isolated"}'
    ),
    (
      'cli-flag-drift',
      'CLI flag drift',
      'CLI still dumps the legacy pipe format; --format=v2 is the contract. Original Isolated fixture.',
      '{"schemaVersion":1,"horizon":"t1","domain":"horizon-swe","sandbox":"isolated"}'
    ),
    (
      'incident-us-inventory',
      'US warehouse inventory incident',
      'US-east warehouse allocation is failing. Original work pack; Simulated Slack/GitHub/Jira/Grafana only.',
      '{"schemaVersion":1,"horizon":"t2","domain":"incident","packKey":"incident-us-inventory"}'
    ),
    (
      'wave-pricing',
      'Wave pricing — revising list price',
      'Three waves; WAVE-2 revises WAVE-1 list price. Original work pack.',
      '{"schemaVersion":1,"horizon":"t3","domain":"evolving-spec","packKey":"wave-pricing"}'
    ),
    (
      'support-desk-clone',
      'Support desk clone',
      'Claim, macro, SLA hold, and note on Simulated ticket queue / macro panel / SLA board. Original work pack.',
      '{"schemaVersion":1,"horizon":"t2","domain":"app-clone","packKey":"support-desk-clone"}'
    )
) as payload(external_key, name, description, metadata)
where b.key = 'agentforge-internal'
  and bv.version = '1.0.0'
on conflict (benchmark_version_id, external_key) do nothing;

insert into public.task_versions (task_id, version)
select t.id, '1.0.0'
from public.tasks t
inner join public.benchmark_versions bv on bv.id = t.benchmark_version_id
inner join public.benchmarks b on b.id = bv.benchmark_id
where b.key = 'agentforge-internal'
  and t.external_key in (
    'refund-double-apply',
    'timezone-cutoff-orders',
    'webhook-retry-storm',
    'migration-partial-rows',
    'cli-flag-drift',
    'incident-us-inventory',
    'wave-pricing',
    'support-desk-clone'
  )
on conflict (task_id, version) do nothing;
