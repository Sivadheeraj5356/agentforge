begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

select has_table('public', 'finding_reviews', 'finding_reviews exists');
select has_table('public', 'evaluation_suites', 'evaluation_suites exists');
select has_table('public', 'eval_scenarios', 'eval_scenarios exists');
select has_table('public', 'environment_versions', 'environment_versions exists');
select has_table('public', 'rollouts', 'rollouts exists');
select has_table('public', 'dataset_versions', 'dataset_versions exists');

select ok(
  exists (select 1 from public.benchmarks where key = 'agentforge-internal'),
  'catalog renamed to agentforge-internal'
);

select is(
  (select count(*)::int from public.agents where provider = 'agentforge' and name in ('oracle', 'nop', 'multi-agent')),
  3,
  'harness agents use agentforge provider'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.finding_reviews'::regclass),
  'RLS on finding_reviews'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.eval_scenarios'::regclass),
  'RLS on eval_scenarios'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.dataset_versions'::regclass),
  'RLS on dataset_versions'
);

do $$
declare
  alice_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  bob_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  carol_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  dave_id uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    (
      alice_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'alice-plat@example.com', crypt('password-alice', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Alice"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      bob_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'bob-plat@example.com', crypt('password-bob', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Bob"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      carol_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'carol-plat@example.com', crypt('password-carol', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Carol"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      dave_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'dave-plat@example.com', crypt('password-dave', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Dave"}'::jsonb,
      now(), now(), '', '', '', ''
    )
  on conflict (id) do nothing;
end
$$;

create or replace function pg_temp.authenticate_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end;
$$;

create or replace function pg_temp.as_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  execute 'set local role service_role';
end;
$$;

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    select public.ensure_personal_organization();
  $$,
  'alice personal org'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    select public.ensure_personal_organization();
  $$,
  'bob personal org'
);

select lives_ok(
  $$
    reset role;
    insert into public.organization_memberships (organization_id, user_id, role)
    select o.id, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'member'
    from public.organizations o
    where o.slug like 'personal-aaaaaaaa%'
    limit 1;
    insert into public.organization_memberships (organization_id, user_id, role)
    select o.id, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'member'
    from public.organizations o
    where o.slug like 'personal-aaaaaaaa%'
    limit 1;
  $$,
  'carol and dave join alice org'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.projects (organization_id, name, slug, created_by)
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      'Platform',
      'platform',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
    insert into public.evaluation_workflow_memberships (organization_id, user_id, workflow_role)
    select o.id, u.id, r.role
    from public.organizations o
    cross join (values
      ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'reviewer'::public.workflow_role),
      ('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'reviewer'::public.workflow_role)
    ) as r(id, role)
    cross join lateral (select r.id) u
    where o.slug like 'personal-aaaaaaaa%'
    limit 2;
  $$,
  'alice assigns independent reviewers'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.eval_scenarios (
      organization_id, project_id, key, name, request_text, difficulty,
      authoring_source, trusted, created_by
    )
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      (select id from public.projects where slug = 'platform'),
      'ai-draft',
      'AI draft',
      'do the thing now please',
      'easy',
      'ai_assisted',
      true,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  $$,
  '23514',
  null,
  'AI-assisted scenarios are not auto-trusted'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.eval_scenarios (
      organization_id, project_id, key, name, request_text, difficulty,
      authoring_source, trusted, created_by
    )
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      (select id from public.projects where slug = 'platform'),
      'human-case',
      'Human case',
      'do the thing now please',
      'medium',
      'human',
      false,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  $$,
  'human scenario insert'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    )
    select count(*)::int
    from auth_ctx, public.eval_scenarios s
    where s.key = 'human-case'
  ),
  0,
  'bob cannot see alice private scenarios'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.dataset_versions (organization_id, name, version, created_by)
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      'held-out',
      '1.0.0',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  $$,
  'dataset version insert defaults PRIVATE'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    )
    select privacy_class::text
    from auth_ctx, public.dataset_versions
    where name = 'held-out'
  ),
  'PRIVATE',
  'dataset privacy defaults to PRIVATE'
);

select lives_ok(
  $$
    reset role;
    insert into public.reviews (organization_id, created_by, status)
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'open'
    );
    insert into public.findings (
      review_id, category, severity, title, description, evidence, source, status
    )
    select r.id, 'evaluation-review', 'medium', 'Check verifier',
      'NOP pass would mean the grader is not intact.',
      '{"summary":"seed evidence"}'::jsonb, 'human', 'open'
    from public.reviews r
    order by r.created_at desc
    limit 1;
  $$,
  'review finding fixture'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('cccccccc-cccc-cccc-cccc-cccccccccccc');
    insert into public.finding_reviews (
      finding_id, organization_id, reviewer_id, decision, rationale, evidence
    )
    select f.id, r.organization_id, 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'accept', 'Looks correct after reading the NOP row.',
      '{"summary":"NOP failed as expected"}'::jsonb
    from public.findings f
    inner join public.reviews r on r.id = f.review_id
    order by f.created_at desc
    limit 1;
  $$,
  'carol submits first independent review'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('dddddddd-dddd-dddd-dddd-dddddddddddd')
    )
    select count(*)::int
    from auth_ctx, public.finding_reviews fr
  ),
  0,
  'dave cannot see carol rationale before submitting'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    select public.enqueue_held_out_evaluations(
      (select id from public.training_experiments limit 1)
    );
  $$,
  '42501',
  null,
  'authenticated cannot enqueue held-out evaluations'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    select public.create_webhook_endpoint(
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      'http://127.0.0.1:8787/hooks',
      array['evaluation.completed']::text[]
    );
  $$,
  'owner can create a signed webhook'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    select 1 from public.webhook_endpoint_secrets;
  $$,
  '42501',
  null,
  'authenticated cannot read webhook secrets'
);

select * from finish();
rollback;
