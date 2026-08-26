begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

select has_table('public', 'validation_runs', 'validation_runs table exists');
select has_table('public', 'validation_findings', 'validation_findings table exists');
select has_type('public', 'validation_run_status', 'validation_run_status enum exists');
select has_type('public', 'validation_finding_severity', 'validation_finding_severity enum exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.validation_runs'::regclass),
  'RLS enabled on validation_runs'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.validation_findings'::regclass),
  'RLS enabled on validation_findings'
);

select has_index(
  'public',
  'validation_runs',
  'validation_runs_project_id_created_at_idx',
  'validation_runs indexed by project + created_at'
);
select has_index(
  'public',
  'validation_findings',
  'validation_findings_validation_run_id_idx',
  'validation_findings indexed by run'
);

select is(
  (
    select count(*)::int
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'evaluation_runs'
      and column_name = 'validation_run_id'
  ),
  0,
  'evaluation_runs is not overloaded with validation_run_id'
);

select has_column('public', 'validation_runs', 'outcome', 'validation_runs records a policy outcome');
select has_column('public', 'validation_runs', 'policy', 'validation_runs records the policy applied');
select has_column(
  'public', 'validation_runs', 'validators', 'validation_runs records validator ids and versions'
);
select has_column('public', 'validation_runs', 'duration_ms', 'validation_runs records duration');
select has_column(
  'public', 'validation_runs', 'adapter_version', 'validation_runs records the benchmark version'
);
select has_column('public', 'validation_runs', 'task_version', 'validation_runs records task version');
select has_column(
  'public', 'validation_findings', 'category', 'validation_findings records a category'
);
select has_column(
  'public',
  'validation_findings',
  'fingerprint',
  'validation_findings records a stable logical identity'
);
select has_index(
  'public',
  'validation_findings',
  'validation_findings_fingerprint_idx',
  'validation_findings indexed by fingerprint for run diffing'
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
      'alice-val@example.com', crypt('password-alice', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Alice"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      bob_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'bob-val@example.com', crypt('password-bob', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Bob"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      carol_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'carol-val@example.com', crypt('password-carol', gen_salt('bf')), now(),
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
      'Alice Val',
      'alice-val',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  $$,
  'alice project'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    insert into public.projects (organization_id, name, slug, created_by)
    values (
      (select id from public.organizations where slug like 'personal-bbbbbbbb%' limit 1),
      'Bob Val',
      'bob-val',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    );
  $$,
  'bob project'
);

do $$
declare
  alice_org uuid;
  bob_org uuid;
  alice_project uuid;
  bob_project uuid;
  alice_artifact uuid;
  bob_artifact uuid;
begin
  execute 'reset role';

  select o.id into alice_org from public.organizations o where o.slug = 'personal-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  select o.id into bob_org from public.organizations o where o.slug = 'personal-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  if alice_org is null or bob_org is null or alice_org = bob_org then
    raise exception 'personal orgs not isolated';
  end if;

  select id into alice_project from public.projects where slug = 'alice-val' and organization_id = alice_org;
  select id into bob_project from public.projects where slug = 'bob-val' and organization_id = bob_org;
  if alice_project is null or bob_project is null then
    raise exception 'expected alice-val and bob-val projects';
  end if;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (alice_org, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'member')
  on conflict do nothing;

  insert into public.artifacts (
    organization_id, kind, content_hash, byte_size, content_type, storage_key
  ) values (
    alice_org,
    'archive',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    12,
    'application/zip',
    'orgs/alice/ingest/a/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.zip'
  )
  returning id into alice_artifact;

  insert into public.artifacts (
    organization_id, kind, content_hash, byte_size, content_type, storage_key
  ) values (
    bob_org,
    'archive',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    12,
    'application/zip',
    'orgs/bob/ingest/b/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.zip'
  )
  returning id into bob_artifact;

  insert into public.validation_runs (
    project_id, artifact_id, status, started_at, completed_at,
    critical_count, error_count, warning_count, info_count, adapter_id,
    adapter_version, task_version, artifact_content_hash, policy, outcome,
    validators, validator_error_count, duration_ms
  ) values (
    alice_project,
    alice_artifact,
    'succeeded',
    now(),
    now(),
    0, 1, 0, 1,
    'terminus',
    '2.0.0',
    '1.0.0',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'strict',
    'fail',
    '[{"id":"metadata","name":"Task metadata","version":"2.0.0"}]'::jsonb,
    0,
    42
  );

  insert into public.validation_runs (
    project_id, artifact_id, status, started_at, completed_at,
    critical_count, error_count, warning_count, info_count, adapter_id
  ) values (
    bob_project,
    bob_artifact,
    'succeeded',
    now(),
    now(),
    0, 0, 0, 0,
    'terminus'
  );

  perform set_config('test.alice_project', alice_project::text, true);
  perform set_config('test.bob_project', bob_project::text, true);
  perform set_config('test.alice_artifact', alice_artifact::text, true);
end
$$;

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  $$,
  'authenticate alice for isolation check'
);

select is(
  (
    select count(*)::int
    from public.validation_runs vr
    where vr.project_id = current_setting('test.bob_project')::uuid
  ),
  0,
  'alice cannot see bob validation runs'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('cccccccc-cccc-cccc-cccc-cccccccccccc')
    )
    select count(*)::int
    from auth_ctx, public.validation_runs vr
    where vr.project_id = (select id from public.projects where slug = 'alice-val')
  ),
  1,
  'member can select org validation runs'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('cccccccc-cccc-cccc-cccc-cccccccccccc');
    insert into public.validation_runs (project_id, artifact_id, status)
    values (
      (select id from public.projects where slug = 'alice-val'),
      (select id from public.artifacts where content_hash like 'aaa%' limit 1),
      'queued'
    );
  $$,
  null,
  null,
  'member cannot insert validation runs'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.validation_findings (
      validation_run_id, code, category, severity, title, message, evidence, validator_id,
      fingerprint, ordinal
    )
    select id, 'TASK_METADATA_MISSING', 'metadata', 'error', 'Missing metadata', 'task.toml missing',
      '{"schemaVersion":1,"path":"task.toml"}'::jsonb, 'metadata',
      repeat('a', 64), 0
    from public.validation_runs
    where project_id = (select id from public.projects where slug = 'alice-val')
    limit 1;
  $$,
  'owner can insert validation findings'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.validation_findings (
      validation_run_id, code, category, severity, title, message, fingerprint, ordinal
    )
    select id, 'TASK_METADATA_MISSING', 'vibes', 'error', 'Missing metadata', 'task.toml missing',
      repeat('b', 64), 1
    from public.validation_runs
    where project_id = (select id from public.projects where slug = 'alice-val')
    limit 1;
  $$,
  '23514',
  null,
  'unknown finding category rejected'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.validation_findings (
      validation_run_id, code, category, severity, title, message, fingerprint, ordinal
    )
    select id, 'TASK_METADATA_MISSING', 'metadata', 'error', 'Missing metadata', 'task.toml missing',
      'not-a-digest', 2
    from public.validation_runs
    where project_id = (select id from public.projects where slug = 'alice-val')
    limit 1;
  $$,
  '23514',
  null,
  'malformed finding fingerprint rejected'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.validation_findings (
      validation_run_id, code, category, severity, title, message, fingerprint, ordinal
    )
    select id, 'TASK_TEST_ENTRYPOINT_MISSING', 'tests', 'error', 'Missing tests', 'tests missing',
      repeat('c', 64), 0
    from public.validation_runs
    where project_id = (select id from public.projects where slug = 'alice-val')
    limit 1;
  $$,
  '23505',
  null,
  'duplicate finding ordinal rejected within a run'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.validation_runs (
      project_id, artifact_id, status, started_at, completed_at, artifact_content_hash
    ) values (
      (select id from public.projects where slug = 'alice-val'),
      current_setting('test.alice_artifact')::uuid,
      'succeeded',
      now(),
      now(),
      repeat('d', 64)
    );
  $$,
  '23514',
  'artifact_content_hash does not match the pinned artifact',
  'recorded artifact hash must match the pinned artifact'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    update public.validation_runs
    set artifact_content_hash = null
    where project_id = (select id from public.projects where slug = 'alice-val');
  $$,
  '23514',
  'validation run artifact hash is immutable',
  'recorded artifact hash cannot be cleared'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    update public.validation_runs
    set outcome = 'exploded'
    where project_id = (select id from public.projects where slug = 'alice-val');
  $$,
  '23514',
  null,
  'unknown run outcome rejected'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.validation_runs (project_id, artifact_id, status, outcome)
    values (
      (select id from public.projects where slug = 'alice-val'),
      current_setting('test.alice_artifact')::uuid,
      'queued',
      'pass'
    );
  $$,
  '23514',
  null,
  'outcome cannot be recorded before the run completes'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    )
    select count(*)::int from auth_ctx, public.validation_findings
  ),
  0,
  'bob cannot see alice validation findings'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    delete from public.validation_runs
    where project_id = (select id from public.projects where slug = 'alice-val');
  $$,
  '42501',
  null,
  'authenticated DELETE denied on validation_runs'
);

select * from finish();
rollback;
