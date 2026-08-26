-- Chunk 2: profiles, organizations, memberships, RLS, personal workspace bootstrap

create extension if not exists pgcrypto with schema extensions;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to postgres, service_role;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'organization_role') then
    create type public.organization_role as enum ('owner', 'admin', 'member');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (
    display_name is null
    or (char_length(display_name) >= 1 and char_length(display_name) <= 80)
  ),
  constraint profiles_display_name_trimmed check (
    display_name is null or display_name = btrim(display_name)
  ),
  constraint profiles_avatar_url_length check (
    avatar_url is null or char_length(avatar_url) <= 2048
  )
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_length check (
    char_length(name) >= 1 and char_length(name) <= 80
  ),
  constraint organizations_name_trimmed check (name = btrim(name)),
  constraint organizations_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(slug) >= 2
    and char_length(slug) <= 48
  ),
  constraint organizations_slug_unique unique (slug)
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.organization_role not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_memberships_user_id_idx
  on public.organization_memberships (user_id);

create index organizations_slug_idx
  on public.organizations (slug);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile bootstrap on auth.users
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display text;
begin
  v_display := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_display is not null and char_length(v_display) > 80 then
    v_display := left(v_display, 80);
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, v_display);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Private membership helper (avoids RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function app_private.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function app_private.is_organization_member(uuid) from public;
grant execute on function app_private.is_organization_member(uuid) to authenticated;

create or replace function app_private.is_organization_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

revoke all on function app_private.is_organization_owner(uuid) from public;
grant execute on function app_private.is_organization_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Personal workspace bootstrap (atomic, idempotent, race-safe)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_personal_organization()
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org public.organizations;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select o.*
  into v_org
  from public.organizations o
  inner join public.organization_memberships m on m.organization_id = o.id
  where m.user_id = v_uid
    and m.role = 'owner'
  order by o.created_at asc
  limit 1;

  if found then
    return v_org;
  end if;

  -- Deterministic personal slug: unique per user → unique-violation is race-safe
  v_slug := 'personal-' || replace(v_uid::text, '-', '');

  begin
    insert into public.organizations (name, slug, created_by)
    values ('My Workspace', v_slug, v_uid)
    returning * into v_org;

    insert into public.organization_memberships (organization_id, user_id, role)
    values (v_org.id, v_uid, 'owner');
  exception
    when unique_violation then
      select o.*
      into v_org
      from public.organizations o
      where o.slug = v_slug;

      if not found then
        select o.*
        into v_org
        from public.organizations o
        inner join public.organization_memberships m on m.organization_id = o.id
        where m.user_id = v_uid
          and m.role = 'owner'
        order by o.created_at asc
        limit 1;
      else
        insert into public.organization_memberships (organization_id, user_id, role)
        values (v_org.id, v_uid, 'owner')
        on conflict do nothing;
      end if;
  end;

  if v_org.id is null then
    raise exception 'Unable to ensure personal organization';
  end if;

  return v_org;
end;
$$;

revoke all on function public.ensure_personal_organization() from public;
grant execute on function public.ensure_personal_organization() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;

alter table public.profiles force row level security;
alter table public.organizations force row level security;
alter table public.organization_memberships force row level security;

-- profiles
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- organizations
create policy organizations_select_member
  on public.organizations
  for select
  to authenticated
  using (app_private.is_organization_member(id));

create policy organizations_update_owner
  on public.organizations
  for update
  to authenticated
  using (app_private.is_organization_owner(id))
  with check (app_private.is_organization_owner(id));

-- memberships: read within accessible orgs; no direct write for authenticated
create policy memberships_select_member
  on public.organization_memberships
  for select
  to authenticated
  using (app_private.is_organization_member(organization_id));

-- Grants (table access; RLS still applies)
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select on public.organization_memberships to authenticated;
