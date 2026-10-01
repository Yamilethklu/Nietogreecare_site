-- Allow the mobile app to use the same Supabase session/admin allowlist as the web panel.
-- The service role remains supported for server APIs, but authenticated admins can now
-- read and update the operational records from the Expo app without embedding secrets.

alter table public.crew_members enable row level security;
alter table public.service_plans enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_invoices enable row level security;

grant select, insert, update, delete on public.crew_members to authenticated;
grant select, insert, update, delete on public.service_plans to authenticated;
grant select, insert, update, delete on public.work_orders to authenticated;
grant select, insert, update, delete on public.work_invoices to authenticated;

drop policy if exists "crew_members_admin_all" on public.crew_members;
create policy "crew_members_admin_all"
  on public.crew_members for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "service_plans_admin_all" on public.service_plans;
create policy "service_plans_admin_all"
  on public.service_plans for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "work_orders_admin_all" on public.work_orders;
create policy "work_orders_admin_all"
  on public.work_orders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "work_invoices_admin_all" on public.work_invoices;
create policy "work_invoices_admin_all"
  on public.work_invoices for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Optional worker access for future app mode: a worker can see/update only their orders
-- when their authenticated email matches an active crew member.
drop policy if exists "crew_members_self_select" on public.crew_members;
create policy "crew_members_self_select"
  on public.crew_members for select
  to authenticated
  using (active = true and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "work_orders_worker_select" on public.work_orders;
create policy "work_orders_worker_select"
  on public.work_orders for select
  to authenticated
  using (
    exists (
      select 1 from public.crew_members cm
      where cm.id = work_orders.crew_member_id
        and cm.active = true
        and lower(cm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "work_orders_worker_update" on public.work_orders;
create policy "work_orders_worker_update"
  on public.work_orders for update
  to authenticated
  using (
    exists (
      select 1 from public.crew_members cm
      where cm.id = work_orders.crew_member_id
        and cm.active = true
        and lower(cm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    exists (
      select 1 from public.crew_members cm
      where cm.id = work_orders.crew_member_id
        and cm.active = true
        and lower(cm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
