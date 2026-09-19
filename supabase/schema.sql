-- NIETO GREEN CARE LLC — esquema base para Supabase PostgreSQL.
-- Ejecutar antes de policies.sql y storage.sql.
create extension if not exists "pgcrypto";

do $$ begin create type public.lead_status as enum ('pending','scheduled','completed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_method as enum ('cash','transfer','on_completion'); exception when duplicate_object then null; end $$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), full_name text not null, phone text, email text,
  address text, zip_code text, city text, notes text, total_jobs integer not null default 0,
  total_revenue numeric(12,2) not null default 0, last_service_date date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists customers_phone_key on public.customers (regexp_replace(coalesce(phone,''),'[^0-9]','','g')) where phone is not null and phone <> '';

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(), name text not null, service_key text,
  min_sq_ft numeric(12,2) not null default 0, max_sq_ft numeric(12,2), price numeric(12,2) not null default 0,
  price_per_sq_ft numeric(12,4), price_per_cubic_yard numeric(12,2), default_depth_inches numeric(6,2) not null default 2,
  capacity_per_day integer not null default 4, duration_minutes integer not null default 90, is_active boolean not null default true, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(), reference_code text not null unique,
  address text not null, formatted_address text, zip_code text not null, city text, state text default 'TX', place_id text, latitude double precision, longitude double precision,
  area_sq_ft numeric(12,2) not null default 0, area_sq_yd numeric(12,2) not null default 0, estimated_cubic_yards numeric(12,2) not null default 0, depth_inches numeric(6,2) not null default 2,
  polygon jsonb, polygon_path text, snapshot_url text, map_bounds jsonb,
  has_gate_code boolean not null default false, gate_code text, requested_date date, requested_time_window text,
  selected_services jsonb not null default '[]'::jsonb, service_count integer not null default 0,
  customer_name text not null, customer_phone text not null, customer_email text, details text, additional_notes text,
  payment_method public.payment_method not null default 'on_completion', status public.lead_status not null default 'pending', final_price numeric(12,2),
  scheduled_for timestamptz, confirmed_at timestamptz, completed_at timestamptz, cancelled_at timestamptz,
  notification_sms_sent boolean not null default false, notification_email_sent boolean not null default false, notification_error text,
  admin_notes text, assigned_crew text, source text not null default 'website', customer_id uuid references public.customers(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists leads_status_idx on public.leads(status); create index if not exists leads_requested_date_idx on public.leads(requested_date); create index if not exists leads_customer_phone_idx on public.leads(customer_phone);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(), title text, description text, storage_path text, public_url text not null,
  service_key text, location text, taken_on date, is_carousel boolean not null default false, carousel_order integer,
  is_published boolean not null default true, is_featured boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.app_settings (key text primary key, value jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(), lead_id uuid references public.leads(id) on delete cascade, title text not null, description text,
  starts_at timestamptz not null, ends_at timestamptz, reminder_at timestamptz, reminder_sent boolean not null default false, all_day boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists customers_updated_at on public.customers; create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
drop trigger if exists pricing_rules_updated_at on public.pricing_rules; create trigger pricing_rules_updated_at before update on public.pricing_rules for each row execute function public.set_updated_at();
drop trigger if exists leads_updated_at on public.leads; create trigger leads_updated_at before update on public.leads for each row execute function public.set_updated_at();
drop trigger if exists gallery_updated_at on public.gallery; create trigger gallery_updated_at before update on public.gallery for each row execute function public.set_updated_at();

create or replace function public.lead_lifecycle() returns trigger language plpgsql security definer set search_path=public as $$
declare cid uuid; amount numeric(12,2); start_at timestamptz;
begin
  if new.customer_id is null then
    select id into cid from public.customers where regexp_replace(coalesce(phone,''),'[^0-9]','','g')=regexp_replace(new.customer_phone,'[^0-9]','','g') limit 1;
    if cid is null then insert into public.customers(full_name,phone,email,address,zip_code,city) values(new.customer_name,new.customer_phone,new.customer_email,new.address,new.zip_code,new.city) returning id into cid; end if;
    new.customer_id:=cid;
  end if;
  if tg_op='UPDATE' and old.status is distinct from 'completed' and new.status='completed' then
    amount:=coalesce(new.final_price,0); update public.customers set total_jobs=total_jobs+1,total_revenue=total_revenue+amount,last_service_date=coalesce(new.requested_date,current_date) where id=new.customer_id; new.completed_at:=coalesce(new.completed_at,now());
  end if;
  if tg_op='UPDATE' and old.status is distinct from 'scheduled' and new.status='scheduled' then
    start_at:=coalesce(new.scheduled_for,new.requested_date::timestamptz,now());
    insert into public.calendar_events(lead_id,title,description,starts_at,ends_at,reminder_at) values(new.id,'Nieto Green Care - '||new.customer_name,new.address||' · '||new.customer_phone,start_at,start_at+interval '2 hours',start_at-interval '1 day'); new.confirmed_at:=coalesce(new.confirmed_at,now());
  elsif tg_op='UPDATE' and new.status='cancelled' then delete from public.calendar_events where lead_id=new.id; new.cancelled_at:=coalesce(new.cancelled_at,now()); end if;
  return new;
end $$;
drop trigger if exists leads_lifecycle on public.leads; create trigger leads_lifecycle before insert or update on public.leads for each row execute function public.lead_lifecycle();

create or replace view public.dashboard_metrics as select count(*)::int total_leads, count(*) filter(where status='pending')::int pending_leads, count(*) filter(where status='scheduled')::int scheduled_leads, count(*) filter(where status='completed')::int completed_jobs, count(*) filter(where status='cancelled')::int cancelled_leads, coalesce(sum(final_price) filter(where status='completed'),0) total_revenue, coalesce(sum(final_price) filter(where status in ('pending','scheduled')),0) pipeline_revenue, coalesce(sum(area_sq_ft),0) total_sq_ft_measured, count(distinct customer_id)::int total_customers, coalesce(avg(final_price) filter(where status='completed'),0) average_ticket from public.leads;
create or replace view public.customer_history as select c.id customer_id,c.full_name,c.phone,c.email,c.city,c.zip_code,count(l.id)::int total_requests,count(l.id) filter(where l.status='completed')::int completed_jobs,count(l.id) filter(where l.status='scheduled')::int scheduled_jobs,count(l.id) filter(where l.status='cancelled')::int cancelled_jobs,coalesce(sum(l.final_price) filter(where l.status='completed'),0) total_paid,max(l.requested_date) last_requested_date,max(l.updated_at) last_activity_at from public.customers c left join public.leads l on l.customer_id=c.id group by c.id;

insert into public.pricing_rules(name,service_key,min_sq_ft,max_sq_ft,price,price_per_sq_ft,capacity_per_day,duration_minutes) values ('Hasta 2,000 sq ft','mowing',0,2000,45,.035,6,45),('2,000 a 5,000 sq ft','mowing',2000,5000,75,.025,5,60),('5,000 a 10,000 sq ft','mowing',5000,10000,125,.018,4,90),('Más de 10,000 sq ft','mowing',10000,null,210,.013,3,120) on conflict do nothing;