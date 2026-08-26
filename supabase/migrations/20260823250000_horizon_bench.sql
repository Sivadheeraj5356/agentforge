-- Horizon v1 catalog: original Isolated + work-pack tasks. No vendored SWE instances.

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
      'ledger-evolve',
      'Horizon SWE — ledger evolve',
      'Idempotent POST, migrate legacy rows, update the CLI. Original Isolated fixture inspired by multi-obligation evolution, not a copied SWE-EVO instance.',
      '{"schemaVersion":1,"horizon":"t2","domain":"horizon-swe","packKey":"horizon-swe"}'
    ),
    (
      'spec-to-kit',
      'Horizon SWE — spec to kit',
      'Implement cutlist_span from SPEC.md. Forbidden lookalike imports fail. Original Isolated fixture inspired by spec-to-repo jobs, not a copied DeNovoSWE row.',
      '{"schemaVersion":1,"horizon":"t2","domain":"horizon-swe","packKey":"horizon-swe"}'
    ),
    (
      'wave-inventory',
      'Wave inventory — revising spec',
      'Three waves; wave 2 revises wave 1. Original work pack. Fable 5 is a design target, not a published score.',
      '{"schemaVersion":1,"horizon":"t3","domain":"evolving-spec","packKey":"wave-inventory"}'
    ),
    (
      'skill-constraint',
      'Skill constraint — audit continuity',
      'Follow in-world SKILL.md: never wipe the audit log. Original work pack.',
      '{"schemaVersion":1,"horizon":"t2","domain":"skill-follow","packKey":"skill-constraint"}'
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
  and t.external_key in ('ledger-evolve', 'spec-to-kit', 'wave-inventory', 'skill-constraint')
on conflict (task_id, version) do nothing;
