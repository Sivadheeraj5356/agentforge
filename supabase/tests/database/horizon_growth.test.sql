begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_table('public', 'billing_customers', 'billing_customers exists');
select has_table('public', 'billing_subscriptions', 'billing_subscriptions exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.billing_customers'::regclass),
  'RLS on billing_customers'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.billing_subscriptions'::regclass),
  'RLS on billing_subscriptions'
);

select is(
  (
    select count(*)::int
    from public.tasks t
    inner join public.benchmark_versions bv on bv.id = t.benchmark_version_id
    inner join public.benchmarks b on b.id = bv.benchmark_id
    where b.key = 'agentforge-internal'
  ),
  23,
  'agentforge-internal catalog grew with original Isolated and work packs'
);

select ok(
  exists (
    select 1 from public.tasks t
    inner join public.benchmark_versions bv on bv.id = t.benchmark_version_id
    inner join public.benchmarks b on b.id = bv.benchmark_id
    where b.key = 'agentforge-internal'
      and t.external_key = 'support-desk-clone'
  ),
  'support-desk-clone is a catalog row'
);

select ok(
  not exists (
    select 1 from public.tasks t
    where t.external_key = 'private-eval-skipped-session'
  ),
  'private-eval sibling keys are not extra catalog rows'
);

select ok(
  exists (
    select 1 from public.tasks t
    where t.external_key = 'refund-double-apply'
  ),
  'refund-double-apply Isolated task is seeded'
);

select * from finish();
rollback;
