alter policy "Allow read access to leads for admin" on public.leads to authenticated using ((select public.is_admin()));
