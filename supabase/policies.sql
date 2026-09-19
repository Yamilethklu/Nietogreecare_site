-- ============================================================================
-- NIETO GREEN CARE LLC — Politicas de seguridad (Row Level Security)
-- Archivo: /supabase/policies.sql
-- Ejecutar DESPUES de schema.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Tabla opcional para administrar la lista blanca sin redeploy
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  full_name  text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.admin_users (email, full_name)
values
  ('nietogreencare@gmail.com', 'Nieto Green Care'),
  ('yamilethklunder@gmail.com', 'Yamileth Klunder')
on conflict (email) do nothing;

alter table public.admin_users enable row level security;

-- ---------------------------------------------------------------------------
-- 1) HELPER: correos autorizados del panel de administracion
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(lower(auth.jwt() ->> 'email'), '') in (
      'nietogreencare@gmail.com',
      'yamilethklunder@gmail.com'
    )
    or exists (
      select 1 from public.admin_users au
      where lower(au.email) = coalesce(lower(auth.jwt() ->> 'email'), '')
        and au.is_active = true
    );
$$;

comment on function public.is_admin() is 'True solo para los correos autorizados del panel Nieto Green Care.';

-- ---------------------------------------------------------------------------
-- 2) Habilitar RLS
-- ---------------------------------------------------------------------------
alter table public.customers        enable row level security;
alter table public.pricing_rules    enable row level security;
alter table public.leads            enable row level security;
alter table public.gallery          enable row level security;
alter table public.app_settings     enable row level security;
alter table public.calendar_events  enable row level security;

-- ---------------------------------------------------------------------------
-- 3) LEADS — el publico (anon) solo puede INSERTAR; admin lee/edita/borra
-- ---------------------------------------------------------------------------
drop policy if exists "leads_public_insert" on public.leads;
create policy "leads_public_insert"
  on public.leads for insert
  to anon, authenticated
  with check (true);

drop policy if exists "leads_admin_select" on public.leads;
create policy "leads_admin_select"
  on public.leads for select
  to authenticated
  using (public.is_admin());

drop policy if exists "leads_admin_update" on public.leads;
create policy "leads_admin_update"
  on public.leads for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "leads_admin_delete" on public.leads;
create policy "leads_admin_delete"
  on public.leads for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4) GALLERY — lectura publica de imagenes publicadas; escritura solo admin
-- ---------------------------------------------------------------------------
drop policy if exists "gallery_public_select" on public.gallery;
create policy "gallery_public_select"
  on public.gallery for select
  to anon, authenticated
  using (is_published = true or public.is_admin());

drop policy if exists "gallery_admin_insert" on public.gallery;
create policy "gallery_admin_insert"
  on public.gallery for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "gallery_admin_update" on public.gallery;
create policy "gallery_admin_update"
  on public.gallery for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "gallery_admin_delete" on public.gallery;
create policy "gallery_admin_delete"
  on public.gallery for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5) CUSTOMERS — solo admin
-- ---------------------------------------------------------------------------
drop policy if exists "customers_admin_all" on public.customers;
create policy "customers_admin_all"
  on public.customers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6) PRICING_RULES — lectura publica (cotizador), escritura admin
-- ---------------------------------------------------------------------------
drop policy if exists "pricing_rules_public_select" on public.pricing_rules;
create policy "pricing_rules_public_select"
  on public.pricing_rules for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "pricing_rules_admin_write" on public.pricing_rules;
create policy "pricing_rules_admin_write"
  on public.pricing_rules for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7) CALENDAR_EVENTS — solo admin
-- ---------------------------------------------------------------------------
drop policy if exists "calendar_admin_all" on public.calendar_events;
create policy "calendar_admin_all"
  on public.calendar_events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 8) APP_SETTINGS — lectura publica, escritura admin
-- ---------------------------------------------------------------------------
drop policy if exists "settings_public_select" on public.app_settings;
create policy "settings_public_select"
  on public.app_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "settings_admin_write" on public.app_settings;
create policy "settings_admin_write"
  on public.app_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 9) ADMIN_USERS — visible/gestionable solo por administradores
-- ---------------------------------------------------------------------------
drop policy if exists "admin_users_admin_all" on public.admin_users;
create policy "admin_users_admin_all"
  on public.admin_users for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 10) GRANTS: las vistas de metricas NUNCA se exponen al publico
-- ---------------------------------------------------------------------------
revoke all on public.dashboard_metrics from anon;
revoke all on public.customer_history from anon;
revoke all on public.dashboard_metrics from authenticated;
revoke all on public.customer_history from authenticated;
grant select on public.dashboard_metrics to service_role;
grant select on public.customer_history to service_role;

grant select, insert on public.leads to anon;
grant select on public.gallery to anon;
grant select on public.pricing_rules to anon;
grant select on public.app_settings to anon;