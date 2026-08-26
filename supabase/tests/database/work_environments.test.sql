begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_column('public', 'evaluation_runs', 'eval_scenario_id', 'eval_scenario_id on runs');

select ok(
  exists (select 1 from public.tasks where external_key = 'production-incident-eu-payments'),
  'incident catalog task exists'
);

select ok(
  exists (select 1 from public.tasks where external_key = 'checkout-console-clone'),
  'checkout clone catalog task exists'
);

select ok(
  exists (select 1 from public.tasks where external_key = 'private-eval-long-horizon'),
  'private eval catalog task exists'
);

select ok(
  exists (select 1 from public.tasks where external_key = 'ledger-evolve'),
  'ledger-evolve catalog task exists'
);

select ok(
  exists (select 1 from public.tasks where external_key = 'spec-to-kit'),
  'spec-to-kit catalog task exists'
);

select ok(
  exists (select 1 from public.tasks where external_key = 'wave-inventory'),
  'wave-inventory catalog task exists'
);

select ok(
  exists (select 1 from public.tasks where external_key = 'skill-constraint'),
  'skill-constraint catalog task exists'
);

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

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'alice-workenv@example.com',
    crypt('password-alice', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Alice"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'bob-workenv@example.com',
    crypt('password-bob', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Bob"}'::jsonb,
    now(), now(), '', '', '', ''
  )
on conflict (id) do nothing;

select lives_ok(
  $$
    select pg_temp.authenticate_as('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
    select public.ensure_personal_organization();
  $$,
  'alice personal org'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('ffffffff-ffff-ffff-ffff-ffffffffffff');
    select public.ensure_personal_organization();
  $$,
  'bob personal org'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
    insert into public.environment_versions (organization_id, adapter_id, version, spec)
    values (
      (select id from public.organizations where slug like 'personal-eeeeeeee%' limit 1),
      'work',
      'incident-eu-1.0.0',
      '{"schemaVersion":1,"packKey":"production-incident-eu-payments"}'::jsonb
    );
  $$,
  'alice can insert work environment version'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('ffffffff-ffff-ffff-ffff-ffffffffffff')
    )
    select count(*)::int
    from auth_ctx, public.environment_versions v
    where v.adapter_id = 'work'
      and v.version = 'incident-eu-1.0.0'
  ),
  0,
  'bob cannot see alice work environment versions'
);

select lives_ok(
  $$
    select pg_temp.authenticate_as('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
    insert into public.rollouts (
      organization_id, environment_version_id, task_version_id, seed, reward
    )
    values (
      (select id from public.organizations where slug like 'personal-eeeeeeee%' limit 1),
      (select ev.id
         from public.environment_versions ev
        where ev.version = 'incident-eu-1.0.0'
          and ev.organization_id = (
            select id from public.organizations where slug like 'personal-eeeeeeee%' limit 1
          )
        limit 1),
      (select tv.id
         from public.task_versions tv
         inner join public.tasks t on t.id = tv.task_id
        where t.external_key = 'production-incident-eu-payments'
        limit 1),
      0,
      0.2000
    );
  $$,
  'alice can insert a scored rollout'
);

select is(
  (
    with auth_ctx as (
      select pg_temp.authenticate_as('ffffffff-ffff-ffff-ffff-ffffffffffff')
    )
    select count(*)::int
    from auth_ctx, public.rollouts r
    where r.reward = 0.2000
  ),
  0,
  'bob cannot see alice world rollouts'
);

select * from finish();
rollback;
