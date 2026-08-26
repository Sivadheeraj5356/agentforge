begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

select has_table('public', 'projects', 'projects table exists');
select has_type('public', 'project_status', 'project_status enum exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.projects'::regclass),
  'RLS enabled on projects'
);

select has_index(
  'public',
  'projects',
  'projects_organization_id_status_idx',
  'projects indexed by organization_id + status'
);

select has_index(
  'public',
  'projects',
  'projects_organization_id_updated_at_idx',
  'projects indexed by organization_id + updated_at'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'projects_organization_id_slug_unique'
      and contype = 'u'
  ),
  'unique organization_id + slug constraint'
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

do $$
declare
  alice_org uuid;
begin
  -- Fixture setup must run as table owner, not leftover authenticated role.
  execute 'reset role';

  select o.id into alice_org
  from public.organizations o
  where o.slug like 'personal-aaaaaaaa%'
  limit 1;

  insert into public.organization_memberships (organization_id, user_id, role)
  values (alice_org, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'member')
  on conflict do nothing;
end
$$;

-- ---------------------------------------------------------------------------
-- Creates / uniqueness / spoof / roles
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.projects (organization_id, name, slug, description, created_by)
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      'Alpha Suite',
      'alpha-suite',
      'First project',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  $$,
  'alice can create project'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.projects (organization_id, name, slug, created_by)
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      'Alpha Dup',
      'alpha-suite',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  $$,
  '23505',
  null,
  'same-org slug uniqueness enforced'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    insert into public.projects (organization_id, name, slug, created_by)
    values (
      (select id from public.organizations where slug like 'personal-bbbbbbbb%' limit 1),
      'Alpha Suite',
      'alpha-suite',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    );
  $$,
  'cross-org same slug allowed'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.projects (organization_id, name, slug, created_by)
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      'Spoof',
      'spoof-project',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    );
  $$,
  null,
  null,
  'created_by spoof rejected by RLS'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('cccccccc-cccc-cccc-cccc-cccccccccccc');
    insert into public.projects (organization_id, name, slug, created_by)
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      'Member Project',
      'member-project',
      'cccccccc-cccc-cccc-cccc-cccccccccccc'
    );
  $$,
  null,
  null,
  'member cannot insert projects'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('cccccccc-cccc-cccc-cccc-cccccccccccc')
    )
    select count(*)::int
    from auth_ctx, public.projects p
    where p.slug = 'alpha-suite'
      and p.organization_id = (
        select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1
      )
  ),
  1,
  'member can select org projects'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    )
    select count(*)::int
    from auth_ctx, public.projects p
    where p.organization_id = (
      select id from public.organizations where slug like 'personal-bbbbbbbb%' limit 1
    )
  ),
  0,
  'alice cannot see bob projects'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('cccccccc-cccc-cccc-cccc-cccccccccccc');
    update public.projects
    set name = 'Hacked'
    where slug = 'alpha-suite'
      and organization_id = (
        select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1
      );
  $$,
  'member update attempt is allowed to run'
);

select is(
  (
    select name
    from public.projects
    where slug = 'alpha-suite'
      and organization_id = (
        select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1
      )
  ),
  'Alpha Suite',
  'member update does not change project name'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    update public.projects
    set status = 'archived', archived_at = now()
    where slug = 'alpha-suite'
      and organization_id = (
        select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1
      );
  $$,
  'owner can archive project'
);

select throws_ok(
  $$
    reset role;
    update public.projects
    set status = 'archived', archived_at = null
    where slug = 'alpha-suite'
      and organization_id = (
        select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1
      );
  $$,
  '23514',
  null,
  'archived without archived_at rejected'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    update public.projects
    set status = 'active', archived_at = null
    where slug = 'alpha-suite'
      and organization_id = (
        select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1
      );
  $$,
  'owner can restore project'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    update public.projects
    set slug = 'renamed'
    where slug = 'alpha-suite'
      and organization_id = (
        select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1
      );
  $$,
  '23514',
  null,
  'slug mutation rejected'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    update public.projects
    set created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    where slug = 'alpha-suite'
      and organization_id = (
        select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1
      );
  $$,
  '23514',
  null,
  'created_by mutation rejected'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    delete from public.projects
    where slug = 'alpha-suite'
      and organization_id = (
        select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1
      );
  $$,
  '42501',
  null,
  'authenticated DELETE denied (no table privilege)'
);

select is(
  (
    select count(*)::int
    from public.projects
    where slug = 'alpha-suite'
      and organization_id = (
        select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1
      )
  ),
  1,
  'project row survives authenticated DELETE'
);

select throws_ok(
  $$
    reset role;
    insert into public.projects (organization_id, name, slug, created_by)
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      '  padded  ',
      'ok-slug',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  $$,
  '23514',
  null,
  'untrimmed name rejected'
);

select throws_ok(
  $$
    reset role;
    insert into public.projects (organization_id, name, slug, created_by)
    values (
      (select id from public.organizations where slug like 'personal-aaaaaaaa%' limit 1),
      'Bad Slug',
      'Bad_Slug',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  $$,
  '23514',
  null,
  'invalid project slug rejected'
);

select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.projects (organization_id, name, slug, created_by)
    values (
      (select id from public.organizations where slug like 'personal-bbbbbbbb%' limit 1),
      'Cross',
      'cross-tenant',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  $$,
  null,
  null,
  'cannot insert project into foreign organization'
);

select * from finish();
rollback;
