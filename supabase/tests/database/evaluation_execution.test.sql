begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

select has_table('public', 'evaluation_jobs', 'evaluation_jobs exists');
select has_table('public', 'evaluation_trials', 'evaluation_trials exists');
select has_table('public', 'training_experiments', 'training_experiments exists');
select has_table('public', 'training_experiment_tasks', 'training_experiment_tasks exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_jobs'::regclass),
  'RLS on evaluation_jobs'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.evaluation_trials'::regclass),
  'RLS on evaluation_trials'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.training_experiments'::regclass),
  'RLS on training_experiments'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.training_experiment_tasks'::regclass),
  'RLS on training_experiment_tasks'
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
  'agentforge-internal catalog includes incident, app-clone, private-eval, and horizon tasks'
);

select is(
  (
    select count(*)::int
    from public.agents
    where provider = 'agentforge'
      and name in ('oracle', 'nop')
  ),
  2,
  'oracle and nop harness agents are seeded'
);

select is(
  (
    select count(*)::int
    from public.agents
    where provider = 'harbor'
      and name = 'terminus-2'
      and version = '1.0.0'
  ),
  1,
  'harbor terminus-2 agent remains as a legacy catalog row'
);

select is(
  (
    select count(*)::int
    from public.agents
    where provider = 'agentforge'
      and name = 'reference'
      and version = '1.0.0'
  ),
  1,
  'agentforge reference agent is seeded'
);

select is(
  (
    select count(*)::int
    from public.agents
    where provider = 'agentforge'
      and name = 'byo'
      and version = '1.0.0'
  ),
  1,
  'agentforge byo agent is seeded'
);

select is(
  (
    select count(*)::int
    from public.agents
    where provider = 'agentforge'
      and name = 'multi-agent'
      and version = '1.0.0'
  ),
  1,
  'multi-agent harness is seeded'
);

select ok(
  exists (select 1 from public.benchmarks where key = 'terminal-bench'),
  'terminal-bench catalog row exists'
);

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
      'alice-exec@example.com', crypt('password-alice', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Alice"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      bob_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'bob-exec@example.com', crypt('password-bob', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Bob"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      carol_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'carol-exec@example.com', crypt('password-carol', gen_salt('bf')), now(),
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

create or replace function pg_temp.as_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);
  execute 'set local role service_role';
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
    reset role;
    insert into public.organization_memberships (organization_id, user_id, role)
    select o.id, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'member'
    from public.organizations o
    where o.slug like 'personal-aaaaaaaa%'
    limit 1
    on conflict do nothing;
  $$,
  'carol is a member of alice org'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.projects (organization_id, name, slug, created_by)
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      'Alice Exec',
      'alice-exec',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  $$,
  'alice creates a project'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    select public.enqueue_evaluation(
      (select id from public.projects where slug = 'alice-exec'),
      'internal_package',
      '{"schemaVersion":1}'::jsonb,
      (
        select t.benchmark_version_id
        from public.tasks t
        where t.external_key = 'broken-orders-api'
        limit 1
      ),
      (
        select tv.id
        from public.task_versions tv
        inner join public.tasks t on t.id = tv.task_id
        where t.external_key = 'broken-orders-api'
        limit 1
      ),
      (select id from public.agents where provider = 'agentforge' and name = 'oracle' limit 1),
      '{"schemaVersion":1,"agentKind":"oracle","sandboxProvider":"fake"}'::jsonb
    );
  $$,
  'alice can enqueue an oracle evaluation'
);

select is(
  (
    select run_number
    from public.evaluation_runs
    where project_id = (select id from public.projects where slug = 'alice-exec')
  ),
  1,
  'first evaluation run_number is 1'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('cccccccc-cccc-cccc-cccc-cccccccccccc');
    select public.enqueue_evaluation(
      (select id from public.projects where slug = 'alice-exec'),
      'internal_package',
      '{}'::jsonb,
      (select t.benchmark_version_id from public.tasks t where t.external_key = 'broken-orders-api' limit 1),
      (
        select tv.id
        from public.task_versions tv
        inner join public.tasks t on t.id = tv.task_id
        where t.external_key = 'broken-orders-api'
        limit 1
      ),
      (select id from public.agents where provider = 'agentforge' and name = 'nop' limit 1),
      '{"schemaVersion":1}'::jsonb
    );
  $$,
  '42501',
  null,
  'member cannot enqueue evaluations'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    select public.claim_evaluation_job('alice-worker');
  $$,
  '42501',
  null,
  'authenticated cannot claim evaluation jobs'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    )
    select count(*)::int
    from auth_ctx, public.evaluation_jobs j
    inner join public.evaluation_runs r on r.id = j.evaluation_run_id
    where r.project_id = (select id from public.projects where slug = 'alice-exec')
  ),
  0,
  'bob cannot see alice evaluation jobs'
);

select lives_ok(
  $$
    select pg_temp.as_service_role();
    select public.claim_evaluation_job('evaluator-1');
  $$,
  'service_role can claim a queued job'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    select public.heartbeat_evaluation_job(
      (select id from public.evaluation_jobs limit 1),
      'evaluator-1'
    );
  $$,
  '42501',
  null,
  'authenticated cannot heartbeat evaluation jobs'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    select public.reclaim_stale_evaluation_jobs(900);
  $$,
  '42501',
  null,
  'authenticated cannot reclaim evaluation jobs'
);

select lives_ok(
  $$
    select pg_temp.as_service_role();
    select public.heartbeat_evaluation_job(
      (select id from public.evaluation_jobs where claimed_by = 'evaluator-1' limit 1),
      'evaluator-1'
    );
  $$,
  'service_role can heartbeat a claimed job'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    update public.evaluation_runs
    set status = 'succeeded', completed_at = now()
    where project_id = (select id from public.projects where slug = 'alice-exec');
  $$,
  '42501',
  null,
  'owner cannot mark an evaluation run succeeded'
);

select lives_ok(
  $$
    reset role;
    insert into public.evaluation_runs (
      project_id, submission_id, benchmark_version_id, task_version_id, agent_id,
      evaluator_configuration, status
    )
    select
      p.id,
      s.id,
      t.benchmark_version_id,
      tv.id,
      a.id,
      '{"schemaVersion":1}'::jsonb,
      'queued'
    from public.projects p
    inner join public.submissions s on s.project_id = p.id
    inner join public.tasks t on t.external_key = 'healthcheck-missing'
    inner join public.task_versions tv on tv.task_id = t.id
    inner join public.agents a on a.provider = 'agentforge' and a.name = 'nop'
    where p.slug = 'alice-exec'
    limit 1;
  $$,
  'queued run fixture for cancel'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    select public.cancel_evaluation_run(
      (
        select id
        from public.evaluation_runs
        where project_id = (select id from public.projects where slug = 'alice-exec')
          and status = 'queued'
        order by created_at desc
        limit 1
      )
    );
  $$,
  'owner can cancel a queued run'
);

select throws_ok(
  format(
    $$
      select pg_temp.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
      select public.cancel_evaluation_run(%L::uuid);
    $$,
    (
      select id::text
      from public.evaluation_runs
      where project_id = (select id from public.projects where slug = 'alice-exec')
      limit 1
    )
  ),
  '42501',
  null,
  'bob cannot cancel alice evaluation'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.evaluation_trials (
      evaluation_run_id, organization_id, attempt_index, status
    )
    select r.id, r.organization_id, 1, 'succeeded'
    from public.evaluation_runs r
    where r.project_id = (select id from public.projects where slug = 'alice-exec')
    limit 1;
  $$,
  '42501',
  null,
  'authenticated cannot insert trials'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.training_experiments (
      organization_id, project_id, name, stage, created_by, notes
    )
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      (select id from public.projects where slug = 'alice-exec'),
      'sft dry-run',
      'sft',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'metrics stay empty until a real run'
    );
  $$,
  'owner can record a planned training experiment'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    )
    select count(*)::int
    from auth_ctx, public.training_experiments e
    where e.organization_id = (
      select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1
    )
  ),
  0,
  'bob cannot see alice training experiments'
);

select * from finish();
rollback;
