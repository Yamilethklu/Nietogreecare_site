-- The mobile editor queries this relation; restore its existing contract.
-- Only administrators may read or modify configuration drafts.
create table if not exists public.site_sections (
  id uuid primary key default gen_random_uuid(),
  section text not null unique,
  title text not null default '',
  body text not null default '',
  visible boolean not null default true
);
alter table public.site_sections enable row level security;
revoke all on public.site_sections from anon, authenticated;
grant select, insert, update, delete on public.site_sections to authenticated;
grant all on public.site_sections to service_role;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='site_sections' and policyname='site_sections_admin_all') then
    create policy site_sections_admin_all on public.site_sections
      for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin()));
  end if;
end $$;
