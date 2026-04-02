-- Stripe customer cache
create table if not exists stripe_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  stripe_customer_id text not null,
  email text not null,
  name text,
  total_spent numeric(12, 2) default 0,
  subscription_status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, stripe_customer_id)
);

-- Stripe subscription cache
create table if not exists stripe_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  stripe_subscription_id text not null,
  stripe_customer_id text not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  amount_per_billing_cycle numeric(12, 2),
  billing_cycle_anchor date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, stripe_subscription_id)
);

-- Stripe transactions log
create table if not exists stripe_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_charge_id text,
  stripe_invoice_id text,
  amount numeric(12, 2) not null,
  currency text default 'usd',
  type text not null,  -- payment, refund
  status text not null,  -- succeeded, failed, pending
  description text,
  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists stripe_customers_org_idx on stripe_customers(organization_id);
create index if not exists stripe_subscriptions_org_idx on stripe_subscriptions(organization_id);
create index if not exists stripe_transactions_org_idx on stripe_transactions(organization_id, created_at desc);

-- RLS
alter table stripe_customers enable row level security;
alter table stripe_subscriptions enable row level security;
alter table stripe_transactions enable row level security;
