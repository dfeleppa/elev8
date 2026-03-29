-- Store products
create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  category text,
  price numeric(10, 2) not null default 0,
  coaches_price numeric(10, 2),
  tax_rate text,
  tax_included_in_price boolean not null default false,
  inventory_count integer,
  image_url text,
  hidden_in_store boolean not null default false,
  defer_to_invoice boolean not null default false,
  notify_admins_on_purchase boolean not null default false,
  has_options boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Product options (sizes, colors, flavors, etc.)
create table if not exists public.store_product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id) on delete cascade,
  option_name text not null,  -- e.g. "Size", "Color"
  option_values text[] not null default '{}',  -- e.g. ["S", "M", "L", "XL"]
  created_at timestamptz default now()
);

-- Preorders
create table if not exists public.store_preorders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  order_deadline date,
  estimated_delivery_date date,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Preorder items (products linked to preorders)
create table if not exists public.store_preorder_items (
  id uuid primary key default gen_random_uuid(),
  preorder_id uuid not null references public.store_preorders(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  created_at timestamptz default now()
);

-- Member store orders
create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  product_id uuid not null references public.store_products(id) on delete cascade,
  preorder_id uuid references public.store_preorders(id) on delete set null,
  quantity integer not null default 1,
  unit_price numeric(10, 2) not null,
  selected_options jsonb,  -- e.g. {"Size": "M", "Color": "Red"}
  status text not null default 'pending',  -- pending, paid, fulfilled, cancelled
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: owners manage products for their org
alter table public.store_products enable row level security;
alter table public.store_product_options enable row level security;
alter table public.store_preorders enable row level security;
alter table public.store_preorder_items enable row level security;
alter table public.store_orders enable row level security;
