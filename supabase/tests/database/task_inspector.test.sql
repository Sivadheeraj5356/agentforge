begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select has_table('public', 'validation_run_tasks', 'validation_run_tasks table exists');
select has_table('public', 'validation_run_files', 'validation_run_files table exists');
select has_column(
  'public', 'validation_runs', 'run_number', 'validation_runs has a display run number'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.validation_run_tasks'::regclass),
  'RLS enabled on validation_run_tasks'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.validation_run_files'::regclass),
  'RLS enabled on validation_run_files'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.validation_run_files'::regclass),
  'RLS forced on validation_run_files'
);

select has_index(
  'public',
  'validation_run_tasks',
  'validation_run_tasks_slug_idx',
  'validation_run_tasks indexed by slug'
);
select has_index(
  'public',
  'validation_run_files',
  'validation_run_files_validation_run_id_idx',
  'validation_run_files indexed by run'
);

do $$
declare
  dana_id uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  erin_id uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    (
      dana_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'dana-task@example.com', crypt('password-dana', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Dana"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      erin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'erin-task@example.com', crypt('password-erin', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Erin"}'::jsonb,
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
    select pg_temp.authenticate_as('dddddddd-dddd-dddd-dddd-dddddddddddd');
    select public.ensure_personal_organization();
  $$,
  'dana bootstrap'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
    select public.ensure_personal_organization();
  $$,
  'erin bootstrap'
);

do $$
declare
  dana_org uuid;
  erin_org uuid;
  dana_project uuid;
  erin_project uuid;
  dana_artifact uuid;
  erin_artifact uuid;
  dana_run_one uuid;
  dana_run_two uuid;
  erin_run uuid;
begin
  execute 'reset role';

  select o.id into dana_org from public.organizations o
  where o.slug = 'personal-dddddddddddddddddddddddddddddddd';
  select o.id into erin_org from public.organizations o
  where o.slug = 'personal-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

  insert into public.projects (organization_id, name, slug, created_by)
  values (dana_org, 'Dana Tasks', 'dana-tasks', 'dddddddd-dddd-dddd-dddd-dddddddddddd')
  returning id into dana_project;

  insert into public.projects (organization_id, name, slug, created_by)
  values (erin_org, 'Erin Tasks', 'erin-tasks', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
  returning id into erin_project;

  insert into public.artifacts (
    organization_id, kind, content_hash, byte_size, content_type, storage_key
  ) values (
    dana_org, 'archive', repeat('1', 64), 42, 'application/zip',
    'orgs/dana/ingest/one/' || repeat('1', 64) || '.zip'
  )
  returning id into dana_artifact;

  insert into public.artifacts (
    organization_id, kind, content_hash, byte_size, content_type, storage_key
  ) values (
    erin_org, 'archive', repeat('2', 64), 42, 'application/zip',
    'orgs/erin/ingest/one/' || repeat('2', 64) || '.zip'
  )
  returning id into erin_artifact;

  insert into public.validation_runs (project_id, artifact_id, status, started_at, completed_at)
  values (dana_project, dana_artifact, 'succeeded', now(), now())
  returning id into dana_run_one;

  insert into public.validation_runs (project_id, artifact_id, status, started_at, completed_at)
  values (dana_project, dana_artifact, 'succeeded', now(), now())
  returning id into dana_run_two;

  insert into public.validation_runs (project_id, artifact_id, status, started_at, completed_at)
  values (erin_project, erin_artifact, 'succeeded', now(), now())
  returning id into erin_run;

  insert into public.validation_run_tasks (
    validation_run_id, ordinal, slug, external_key, root_path, name, task_version
  ) values
    (dana_run_one, 0, 'fix-build', 'fix-build', '', 'Fix the build', '1.0.0'),
    (dana_run_two, 0, 'fix-build', 'fix-build', '', 'Fix the build', '1.0.1');

  insert into public.validation_run_files (validation_run_id, path, byte_size)
  values
    (dana_run_one, 'instruction.md', 120),
    (dana_run_one, 'environment/Dockerfile', 240),
    (erin_run, 'instruction.md', 99);

  perform set_config('test.dana_run_one', dana_run_one::text, true);
  perform set_config('test.dana_run_two', dana_run_two::text, true);
  perform set_config('test.erin_run', erin_run::text, true);
end
$$;

select is(
  (select run_number from public.validation_runs where id = current_setting('test.dana_run_one')::uuid),
  1,
  'first run of a project is numbered 1'
);

select is(
  (select run_number from public.validation_runs where id = current_setting('test.dana_run_two')::uuid),
  2,
  'run numbers increment per project'
);

select is(
  (select run_number from public.validation_runs where id = current_setting('test.erin_run')::uuid),
  1,
  'run numbering restarts in a different project'
);

select throws_ok(
  format(
    $$update public.validation_runs set run_number = 99 where id = %L$$,
    current_setting('test.dana_run_one')
  ),
  '23514',
  'validation run number is immutable',
  'run number cannot be rewritten'
);

select throws_ok(
  format(
    $$
      insert into public.validation_run_files (validation_run_id, path, byte_size)
      values (%L, '../../etc/passwd', 1)
    $$,
    current_setting('test.dana_run_one')
  ),
  '23514',
  null,
  'manifest rejects a traversal path'
);

select throws_ok(
  format(
    $$
      insert into public.validation_run_files (validation_run_id, path, byte_size)
      values (%L, '/etc/passwd', 1)
    $$,
    current_setting('test.dana_run_one')
  ),
  '23514',
  null,
  'manifest rejects an absolute path'
);

select throws_ok(
  format(
    $$
      insert into public.validation_run_tasks
        (validation_run_id, ordinal, slug, external_key, root_path, name)
      values (%L, 5, 'Not A Slug', 'k', '', 'n')
    $$,
    current_setting('test.dana_run_one')
  ),
  '23514',
  null,
  'task slug format is enforced'
);

select throws_ok(
  format(
    $$update public.validation_run_files set byte_size = 1 where validation_run_id = %L$$,
    current_setting('test.dana_run_one')
  ),
  '23514',
  'validation run detail rows are immutable',
  'recorded manifest rows cannot be edited'
);

select throws_ok(
  format(
    $$
      insert into public.validation_run_files (validation_run_id, path, byte_size)
      values (%L, 'instruction.md', 7)
    $$,
    current_setting('test.dana_run_one')
  ),
  '23505',
  null,
  'a manifest lists each path once per run'
);

-- Authentication has to be its own statement: RLS is decided when the reading
-- statement is planned, so switching role inside that statement proves nothing.
select lives_ok(
  $$select pg_temp.authenticate_as('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');$$,
  'authenticate erin for isolation checks'
);

select is(
  (
    select count(*)::int
    from public.validation_run_tasks t
    where t.validation_run_id = current_setting('test.dana_run_one')::uuid
  ),
  0,
  'erin cannot see dana task rows'
);

select is(
  (
    select count(*)::int
    from public.validation_run_files f
    where f.validation_run_id = current_setting('test.dana_run_one')::uuid
  ),
  0,
  'erin cannot see dana manifest rows'
);

select lives_ok(
  $$select pg_temp.authenticate_as('dddddddd-dddd-dddd-dddd-dddddddddddd');$$,
  'authenticate dana for her own report'
);

select is(
  (
    select count(*)::int
    from public.validation_run_files f
    where f.validation_run_id = current_setting('test.dana_run_one')::uuid
  ),
  2,
  'dana sees her own manifest rows'
);

select is(
  (
    select count(*)::int
    from public.validation_run_tasks t
    where t.slug = 'fix-build'
  ),
  2,
  'dana sees the task in both of her runs'
);

select throws_ok(
  format(
    $$
      select pg_temp.authenticate_as('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
      insert into public.validation_run_files (validation_run_id, path, byte_size)
      values (%L, 'planted.md', 1);
    $$,
    current_setting('test.dana_run_one')
  ),
  null,
  null,
  'a non-member cannot plant a manifest row in another org run'
);

select throws_ok(
  format(
    $$
      select pg_temp.authenticate_as('dddddddd-dddd-dddd-dddd-dddddddddddd');
      delete from public.validation_run_files where validation_run_id = %L;
    $$,
    current_setting('test.dana_run_one')
  ),
  '42501',
  null,
  'authenticated DELETE denied on validation_run_files'
);

select throws_ok(
  format(
    $$
      select pg_temp.authenticate_as('dddddddd-dddd-dddd-dddd-dddddddddddd');
      delete from public.validation_run_tasks where validation_run_id = %L;
    $$,
    current_setting('test.dana_run_one')
  ),
  '42501',
  null,
  'authenticated DELETE denied on validation_run_tasks'
);

select * from finish();
rollback;
