-- AgentForge catalog rename. Do not rewrite applied historical migrations.

update public.benchmarks
set
  key = 'agentforge-internal',
  name = 'AgentForge internal suite',
  description = replace(coalesce(description, ''), 'Vortex', 'AgentForge'),
  provider = 'agentforge'
where key = 'vortex-internal';

update public.agents
set provider = 'agentforge'
where provider = 'vortex';

alter table public.benchmark_versions disable trigger benchmark_versions_protect_immutable;

update public.benchmark_versions
set manifest = replace(manifest::text, 'Vortex', 'AgentForge')::jsonb
where manifest::text like '%Vortex%';

alter table public.benchmark_versions enable trigger benchmark_versions_protect_immutable;
