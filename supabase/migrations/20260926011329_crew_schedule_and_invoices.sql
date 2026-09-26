-- Operational records are independent per visit. Existing leads/customers remain intact.
create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  email text not null check (email ~* '^[^@ ]+@[^@ ]+\.[^@ ]+$'),
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists crew_members_email_unique on public.crew_members(lower(email));

create table if not exists public.service_plans (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  crew_member_id uuid references public.crew_members(id) on delete set null,
  cadence text not null check (cadence in ('weekly','bi_weekly','one_time')),
  first_date date not null,
  preferred_start time without time zone not null default '08:00',
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  price_per_visit numeric(12,2) not null check (price_per_visit >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists service_plans_one_active_lead on public.service_plans(lead_id) where active;
create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.service_plans(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete restrict,
  crew_member_id uuid references public.crew_members(id) on delete set null,
  service_date date not null,
  start_time time without time zone not null,
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled')),
  price numeric(12,2) not null check (price >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  payment_method text check (payment_method in ('cash','cash_app','venmo','zelle','check','other')),
  paid_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_orders_payment_max check (paid_amount <= price)
);
create unique index if not exists work_orders_plan_day_unique on public.work_orders(plan_id,service_date);
create index if not exists work_orders_day_crew_idx on public.work_orders(service_date,crew_member_id,start_time);
create index if not exists work_orders_lead_idx on public.work_orders(lead_id);

create table if not exists public.work_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.work_orders(id) on delete restrict,
  invoice_number text not null unique,
  total numeric(12,2) not null check (total >= 0),
  customer_email text,
  issued_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_by text,
  email_error text,
  created_at timestamptz not null default now()
);

-- The API validates Google sessions and scopes crew to their assignments.
-- Only server-side service_role can query these tables; no direct browser access.
alter table public.crew_members enable row level security;
alter table public.service_plans enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_invoices enable row level security;
revoke all on public.crew_members, public.service_plans, public.work_orders, public.work_invoices from anon, authenticated;
grant select, insert, update, delete on public.crew_members, public.service_plans, public.work_orders, public.work_invoices to service_role;

create or replace function public.set_ops_updated_at() returns trigger
language plpgsql set search_path = '' as $$begin new.updated_at = now(); return new; end$$;
drop trigger if exists ops_plan_updated_at on public.service_plans;
create trigger ops_plan_updated_at before update on public.service_plans for each row execute function public.set_ops_updated_at();
drop trigger if exists ops_order_updated_at on public.work_orders;
create trigger ops_order_updated_at before update on public.work_orders for each row execute function public.set_ops_updated_at();
