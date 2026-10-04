alter policy "Allow read access to leads for admin" on public.leads
using (is_admin() OR ((select auth.role()) = 'authenticated'::text) OR ((select auth.role()) = 'anon'::text));
