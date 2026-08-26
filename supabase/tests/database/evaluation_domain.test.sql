begin;

create extension if not exists pgtap with schema extensions;

select plan(47);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

select has_table('public', 'benchmarks', 'benchmarks table exists');
select has_table('public', 'benchmark_versions', 'benchmark_versions table exists');
select has_table('public', 'tasks', 'tasks table exists');
select has_table('public', 'task_versions', 'task_versions table exists');
select has_table('public', 'agents', 'agents table exists');
select has_table('public', 'submissions', 'submissions table exists');
select has_table('public', 'artifacts', 'artifacts table exists');
select has_table('public', 'evaluation_runs', 'evaluation_runs table exists');
select has_table('public', 'evaluation_results', 'evaluation_results table exists');
select has_table('public', 'reviews', 'reviews table exists');
select has_table('public', 'findings', 'findings table exists');
select has_table('public', 'audit_events', 'audit_events table exists');

select has_type('public', 'submission_kind', 'submission_kind enum exists');
select has_type('public', 'evaluation_run_status', 'evaluation_run_status enum exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.benchmarks'::regclass),
  'RLS enabled on benchmarks'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.submissions'::regclass),
  'RLS enabled on submissions'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_runs'::regclass),
  'RLS enabled on evaluation_runs'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.artifacts'::regclass),
  'RLS enabled on artifacts'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_events'::regclass),
  'RLS enabled on audit_events'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_results'::regclass),
  'RLS enabled on evaluation_results'
);

select has_index(
  'public',
  'submissions',
  'submissions_project_id_created_at_idx',
  'submissions indexed by project_id + created_at'
);
select has_index(
  'public',
  'artifacts',
  'artifacts_content_hash_idx',
  'artifacts indexed by content_hash'
);
select has_index(
  'public',
  'audit_events',
  'audit_events_organization_id_created_at_idx',
  'audit_events indexed by organization_id + created_at'
);

select is(
  (
    select count(*)::int
    from information_schema.columns
    where column_name = 'terminus_task_id'
  ),
  0,
  'no terminus_task_id columns on any table'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'benchmark_id'
  ),
  'projects.benchmark_id optional column exists'
);

-- ---------------------------------------------------------------------------
-- Fixture users
-- ---------------------------------------------------------------------------

do $$
declare
  alice_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  bob_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  carol_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    (
      alice_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'alice@example.com', crypt('password-alice', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Alice"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      bob_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'bob@example.com', crypt('password-bob', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Bob"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      carol_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'carol@example.com', crypt('password-carol', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Carol"}'::jsonb,
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

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    select public.ensure_personal_organization();
  $$,
  'alice bootstrap'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    select public.ensure_personal_organization();
  $$,
  'bob bootstrap'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.projects (organization_id, name, slug, created_by)
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      'Alice Eval',
      'alice-eval',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  $$,
  'alice can create project for domain fixtures'
);

do $$
declare
  alice_org uuid;
  bob_org uuid;
  alice_project uuid;
  bob_project uuid;
  bench_id uuid;
  bench_version_id uuid;
  task_id uuid;
  task_version_id uuid;
  agent_id uuid;
  alice_submission uuid;
  bob_submission uuid;
begin
  execute 'reset role';

  select o.id into alice_org from public.organizations o where o.slug like 'personal-aaaaaaaa%' limit 1;
  select o.id into bob_org from public.organizations o where o.slug like 'personal-bbbbbbbb%' limit 1;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (alice_org, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'member')
  on conflict do nothing;

  insert into public.projects (organization_id, name, slug, created_by)
  values (bob_org, 'Bob Eval', 'bob-eval', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

  select id into alice_project from public.projects where slug = 'alice-eval';
  select id into bob_project from public.projects where slug = 'bob-eval';

  insert into public.benchmarks (key, name, provider, status)
  values ('example-suite', 'Example Suite', 'internal', 'published')
  returning id into bench_id;

  insert into public.benchmark_versions (benchmark_id, version, manifest)
  values (bench_id, '1.0.0', '{"schemaVersion":1}'::jsonb)
  returning id into bench_version_id;

  insert into public.tasks (benchmark_version_id, external_key, name)
  values (bench_version_id, 'hello-world', 'Hello World')
  returning id into task_id;

  insert into public.task_versions (task_id, version)
  values (task_id, '1')
  returning id into task_version_id;

  insert into public.agents (provider, name, version, type)
  values ('internal', 'placeholder-agent', '0.1.0', 'model')
  returning id into agent_id;

  insert into public.submissions (project_id, kind, metadata, created_by)
  values
    (alice_project, 'internal_package', '{}'::jsonb, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    (bob_project, 'internal_package', '{}'::jsonb, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

  select id into alice_submission from public.submissions where project_id = alice_project;
  select id into bob_submission from public.submissions where project_id = bob_project;

  insert into public.evaluation_runs (
    project_id, submission_id, benchmark_version_id, task_version_id, agent_id,
    evaluator_configuration, status
  ) values (
    alice_project, alice_submission, bench_version_id, task_version_id, agent_id,
    '{"schemaVersion":1}'::jsonb, 'queued'
  );

  insert into public.evaluation_runs (
    project_id, submission_id, benchmark_version_id, task_version_id, agent_id,
    evaluator_configuration, status
  ) values (
    bob_project, bob_submission, bench_version_id, task_version_id, agent_id,
    '{"schemaVersion":1}'::jsonb, 'queued'
  );

  insert into public.evaluation_results (evaluation_run_id, result_kind, payload)
  select id, 'raw', '{"schemaVersion":1}'::jsonb
  from public.evaluation_runs
  where project_id = alice_project;

  insert into public.artifacts (
    organization_id, kind, content_hash, byte_size, content_type, storage_key
  ) values (
    alice_org,
    'json',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    12,
    'application/json',
    null
  );

  insert into public.reviews (organization_id, project_id, created_by, status)
  values (alice_org, alice_project, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'open');
end
$$;

select throws_ok(
  $$
    set local role anon;
    select count(*) from public.benchmarks;
  $$,
  '42501',
  null,
  'anon cannot select benchmarks'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    )
    select count(*)::int from auth_ctx, public.benchmarks
    where key = 'example-suite'
  ),
  1,
  'authenticated can read catalog benchmarks'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.benchmarks (key, name, provider)
    values ('client-write', 'Nope', 'internal');
  $$,
  '42501',
  null,
  'authenticated cannot insert catalog benchmarks'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    )
    select count(*)::int
    from auth_ctx, public.submissions s
    where s.project_id = (select id from public.projects where slug = 'bob-eval')
  ),
  0,
  'alice cannot see bob submissions'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('cccccccc-cccc-cccc-cccc-cccccccccccc')
    )
    select count(*)::int
    from auth_ctx, public.submissions s
    where s.project_id = (select id from public.projects where slug = 'alice-eval')
  ),
  1,
  'member can select org submissions'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('cccccccc-cccc-cccc-cccc-cccccccccccc');
    insert into public.submissions (project_id, kind, created_by)
    values (
      (select id from public.projects where slug = 'alice-eval'),
      'internal_package',
      'cccccccc-cccc-cccc-cccc-cccccccccccc'
    );
  $$,
  null,
  null,
  'member cannot insert submissions'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.submissions (project_id, kind, created_by)
    values (
      (select id from public.projects where slug = 'alice-eval'),
      'git_repository',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  $$,
  'owner can insert submission metadata'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.submissions (project_id, kind, created_by)
    values (
      (select id from public.projects where slug = 'alice-eval'),
      'git_commit',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    );
  $$,
  null,
  null,
  'created_by spoof rejected on submissions'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.submissions (project_id, kind, created_by)
    values (
      (select id from public.projects where slug = 'bob-eval'),
      'internal_package',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  $$,
  null,
  null,
  'cannot insert submission into foreign project'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    )
    select count(*)::int
    from auth_ctx, public.evaluation_runs er
    where er.project_id = (select id from public.projects where slug = 'bob-eval')
  ),
  0,
  'alice cannot see bob evaluation runs'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.evaluation_results (evaluation_run_id, result_kind, payload)
    select id, 'raw', '{}'::jsonb
    from public.evaluation_runs
    where project_id = (select id from public.projects where slug = 'alice-eval')
    limit 1;
  $$,
  '42501',
  null,
  'authenticated cannot insert evaluation results'
);

select throws_ok(
  $$
    reset role;
    insert into public.artifacts (
      organization_id, kind, content_hash, byte_size, content_type
    ) values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      'json',
      'not-a-hash',
      1,
      'application/json'
    );
  $$,
  '23514',
  null,
  'invalid content_hash rejected'
);

select throws_ok(
  $$
    reset role;
    insert into public.benchmark_versions (benchmark_id, version, manifest)
    values (
      (select id from public.benchmarks where key = 'example-suite'),
      'latest',
      '{}'::jsonb
    );
  $$,
  '23514',
  null,
  'latest version identity rejected'
);

select throws_ok(
  $$
    reset role;
    insert into public.evaluation_runs (
      project_id, submission_id, benchmark_version_id, task_version_id,
      evaluator_configuration, status
    )
    values (
      (select id from public.projects where slug = 'alice-eval'),
      (select id from public.submissions where project_id = (
        select id from public.projects where slug = 'bob-eval'
      ) limit 1),
      (select id from public.benchmark_versions limit 1),
      (select id from public.task_versions limit 1),
      '{"schemaVersion":1}'::jsonb,
      'queued'
    );
  $$,
  '23514',
  null,
  'evaluation run rejects submission from another project'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    )
    select count(*)::int
    from auth_ctx, public.artifacts a
    where a.organization_id = (
      select id from public.organizations where slug like 'personal-bbbbbbbb%' limit 1
    )
  ),
  0,
  'alice cannot see bob artifacts'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('cccccccc-cccc-cccc-cccc-cccccccccccc')
    )
    select count(*)::int
    from auth_ctx, public.evaluation_runs er
    where er.project_id = (select id from public.projects where slug = 'alice-eval')
  ),
  1,
  'member can select org evaluation runs'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    delete from public.evaluation_runs
    where project_id = (select id from public.projects where slug = 'alice-eval');
  $$,
  '42501',
  null,
  'authenticated DELETE denied on evaluation_runs'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    )
    select count(*)::int
    from auth_ctx, public.audit_events e
    where e.organization_id = (
      select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1
    )
  ),
  0,
  'bob cannot see alice audit events'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    )
    select count(*)::int > 0
    from auth_ctx, public.audit_events e
    where e.organization_id = (
      select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1
    )
      and e.action like 'project.%'
  ),
  true,
  'alice project mutations produced audit events'
);

select * from finish();
rollback;
