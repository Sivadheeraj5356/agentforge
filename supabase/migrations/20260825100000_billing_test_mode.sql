-- Stripe test-mode billing rows. Paid flag is metadata; local eval does not require it.

create table public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  stripe_customer_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_customers_organization_id_unique unique (organization_id),
  constraint billing_customers_stripe_customer_id_unique unique (stripe_customer_id),
  constraint billing_customers_stripe_customer_id_format check (
    stripe_customer_id ~ '^cus_[a-zA-Z0-9]+$'
    and char_length(stripe_customer_id) between 8 and 128
  )
);

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  billing_customer_id uuid not null references public.billing_customers (id) on delete cascade,
  stripe_subscription_id text not null,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscriptions_organization_id_unique unique (organization_id),
  constraint billing_subscriptions_stripe_subscription_id_unique unique (stripe_subscription_id),
  constraint billing_subscriptions_stripe_subscription_id_format check (
    stripe_subscription_id ~ '^sub_[a-zA-Z0-9]+$'
    and char_length(stripe_subscription_id) between 8 and 128
  ),
  constraint billing_subscriptions_status_check check (
    status in ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')
  ),
  constraint billing_subscriptions_price_id_length check (
    price_id is null or char_length(price_id) between 8 and 128
  )
);

create index billing_customers_organization_id_idx
  on public.billing_customers (organization_id);

create index billing_subscriptions_organization_id_idx
  on public.billing_subscriptions (organization_id);

create trigger billing_customers_set_updated_at
  before update on public.billing_customers
  for each row execute function public.set_updated_at();

create trigger billing_subscriptions_set_updated_at
  before update on public.billing_subscriptions
  for each row execute function public.set_updated_at();

create or replace function public.billing_protect_organization_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id is immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger billing_customers_protect_organization_id
  before update on public.billing_customers
  for each row execute function public.billing_protect_organization_id();

create trigger billing_subscriptions_protect_organization_id
  before update on public.billing_subscriptions
  for each row execute function public.billing_protect_organization_id();

alter table public.billing_customers enable row level security;
alter table public.billing_customers force row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_subscriptions force row level security;

create policy billing_customers_select_member
  on public.billing_customers
  for select
  to authenticated
  using (app_private.is_organization_member(organization_id));

create policy billing_customers_insert_owner_admin
  on public.billing_customers
  for insert
  to authenticated
  with check (app_private.is_organization_owner_or_admin(organization_id));

create policy billing_customers_update_owner_admin
  on public.billing_customers
  for update
  to authenticated
  using (app_private.is_organization_owner_or_admin(organization_id))
  with check (app_private.is_organization_owner_or_admin(organization_id));

create policy billing_subscriptions_select_member
  on public.billing_subscriptions
  for select
  to authenticated
  using (app_private.is_organization_member(organization_id));

create policy billing_subscriptions_insert_owner_admin
  on public.billing_subscriptions
  for insert
  to authenticated
  with check (app_private.is_organization_owner_or_admin(organization_id));

create policy billing_subscriptions_update_owner_admin
  on public.billing_subscriptions
  for update
  to authenticated
  using (app_private.is_organization_owner_or_admin(organization_id))
  with check (app_private.is_organization_owner_or_admin(organization_id));

grant select, insert, update on public.billing_customers to authenticated;
grant select, insert, update on public.billing_subscriptions to authenticated;
grant select, insert, update, delete on public.billing_customers to service_role;
grant select, insert, update, delete on public.billing_subscriptions to service_role;
