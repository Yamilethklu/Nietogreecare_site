-- Weekly operational summaries saved by the mobile app for later review.
create table if not exists public.weekly_summaries (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  week_end date not null,
  completed_orders integer not null default 0,
  cancelled_orders integer not null default 0,
  unpaid_orders integer not null default 0,
  paid_orders integer not null default 0,
  total_collected numeric(12,2) not null default 0,
  notes text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.weekly_summaries enable row level security;
grant select, insert, update, delete on public.weekly_summaries to authenticated;
grant select, insert, update, delete on public.weekly_summaries to service_role;

drop policy if exists "weekly_summaries_admin_all" on public.weekly_summaries;
create policy "weekly_summaries_admin_all"
  on public.weekly_summaries for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists weekly_summaries_updated_at on public.weekly_summaries;
create trigger weekly_summaries_updated_at
  before update on public.weekly_summaries
  for each row execute function public.set_updated_at();
