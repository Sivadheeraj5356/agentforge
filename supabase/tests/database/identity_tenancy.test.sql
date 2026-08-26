begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- ---------------------------------------------------------------------------
-- Schema & RLS
-- ---------------------------------------------------------------------------

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'organizations', 'organizations table exists');
select has_table(
  'public',
  'organization_memberships',
  'organization_memberships table exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS enabled on profiles'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organizations'::regclass),
  'RLS enabled on organizations'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_memberships'::regclass),
  'RLS enabled on organization_memberships'
);

select has_index(
  'public',
  'organization_memberships',
  'organization_memberships_user_id_idx',
  'memberships indexed by user_id'
);
select has_index(
  'public',
  'organizations',
  'organizations_slug_idx',
  'organizations indexed by slug'
);

-- ---------------------------------------------------------------------------
-- Fixture users
-- ---------------------------------------------------------------------------

do $$
declare
  alice_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  bob_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) values
    (
      alice_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'alice@example.com',
      crypt('password-alice', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Alice"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      bob_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'bob@example.com',
      crypt('password-bob', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Bob"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
  on conflict (id) do nothing;
end
$$;

select is(
  (select display_name from public.profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Alice',
  'profile created for alice with display_name'
);

select is(
  (select display_name from public.profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'Bob',
  'profile created for bob with display_name'
);

-- ---------------------------------------------------------------------------
-- Auth context helper for auth.uid()
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Bootstrap idempotency
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    select public.ensure_personal_organization();
    select public.ensure_personal_organization();
  $$,
  'ensure_personal_organization callable twice'
);

select is(
  (
    select count(*)::int
    from public.organization_memberships
    where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and role = 'owner'
  ),
  1,
  'alice has exactly one owner membership after repeated bootstrap'
);

-- Bob bootstrap
select lives_ok(
  $$
    select pg_temp.authenticate_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    select public.ensure_personal_organization();
  $$,
  'bob can bootstrap personal organization'
);

-- ---------------------------------------------------------------------------
-- Cross-tenant isolation under RLS
-- ---------------------------------------------------------------------------

select is(
  (
    select count(*)::int
    from (
      select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    ) _
    cross join lateral (
      select id from public.organizations
    ) o
  ),
  1,
  'alice sees exactly one organization'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    )
    select count(*)::int
    from auth_ctx, public.organizations o
    where o.slug like 'personal-bbbbbbbb%'
  ),
  0,
  'alice cannot see bob organization by slug'
);

-- Direct membership insert denied for authenticated
select throws_ok(
  $$
    select pg_temp.authenticate_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    insert into public.organization_memberships (organization_id, user_id, role)
    values (
      (select id from public.organizations where slug like 'personal-bbbbbbbb%' limit 1),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'member'
    );
  $$,
  null,
  null,
  'authenticated cannot insert arbitrary memberships'
);

-- Invalid slug rejected (reset role so table-owner path hits CHECK, not RLS grant)
select throws_ok(
  $$
    reset role;
    insert into public.organizations (name, slug, created_by)
    values ('Bad', '-bad-', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  $$,
  '23514',
  null,
  'invalid organization slug rejected by check constraint'
);

select * from finish();
rollback;
