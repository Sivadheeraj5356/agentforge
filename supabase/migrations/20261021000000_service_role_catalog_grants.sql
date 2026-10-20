-- Restore the evaluator importer's server-only catalog permissions.
-- No client-role grants or row-level security policies are changed.
GRANT SELECT ON public.benchmarks TO service_role;
GRANT SELECT ON public.benchmark_versions TO service_role;
GRANT INSERT ON public.tasks TO service_role;
GRANT INSERT ON public.task_versions TO service_role;
