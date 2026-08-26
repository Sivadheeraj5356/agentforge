-- Chunk 3: projects domain (status lifecycle, org-scoped RLS, stable slugs)

do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type public.project_status as enum ('active', 'archived');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Role helper: owner or admin (reuses memberships; avoids RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function app_private.is_organization_owner_or_admin(p_organization_id uuid)
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
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function app_private.is_organization_owner_or_admin(uuid) from public;
grant execute on function app_private.is_organization_owner_or_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Projects table
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status public.project_status not null default 'active',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint projects_name_length check (
    char_length(name) >= 1 and char_length(name) <= 120
  ),
  constraint projects_name_trimmed check (name = btrim(name)),
  constraint projects_description_length check (
    description is null or char_length(description) <= 2000
  ),
  constraint projects_description_trimmed check (
    description is null or description = btrim(description)
  ),
  constraint projects_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(slug) >= 2
    and char_length(slug) <= 64
  ),
  constraint projects_organization_id_slug_unique unique (organization_id, slug),
  constraint projects_status_archived_at_consistent check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  )
);

create index projects_organization_id_status_idx
  on public.projects (organization_id, status);

create index projects_organization_id_updated_at_idx
  on public.projects (organization_id, updated_at desc);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Immutable columns: organization_id, created_by, slug (stable URLs)
-- ---------------------------------------------------------------------------

create or replace function public.projects_protect_immutable_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id is immutable'
      using errcode = '23514';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable'
      using errcode = '23514';
  end if;
  if new.slug is distinct from old.slug then
    raise exception 'slug is immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger projects_protect_immutable_columns
  before update on public.projects
  for each row execute function public.projects_protect_immutable_columns();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.projects force row level security;

create policy projects_select_member
  on public.projects
  for select
  to authenticated
  using (app_private.is_organization_member(organization_id));

create policy projects_insert_owner_admin
  on public.projects
  for insert
  to authenticated
  with check (
    app_private.is_organization_owner_or_admin(organization_id)
    and created_by = (select auth.uid())
  );

create policy projects_update_owner_admin
  on public.projects
  for update
  to authenticated
  using (app_private.is_organization_owner_or_admin(organization_id))
  with check (app_private.is_organization_owner_or_admin(organization_id));

-- No DELETE policy for authenticated — soft-archive only.

grant select, insert, update on public.projects to authenticated;
