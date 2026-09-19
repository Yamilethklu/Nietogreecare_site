-- ============================================================================
-- NIETO GREEN CARE LLC — Storage: buckets y politicas
-- Archivo: /supabase/storage.sql
-- Ejecutar DESPUES de policies.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) BUCKETS
--    gallery         -> publico  (fotos de trabajos + carrusel del landing)
--    lead-snapshots  -> publico  (recortes satelitales del area medida)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('gallery', 'gallery', true, 10485760,
    array['image/png','image/jpeg','image/jpg','image/webp','image/avif']),
  ('lead-snapshots', 'lead-snapshots', true, 5242880,
    array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2) POLITICAS: lectura publica de ambos buckets
-- ---------------------------------------------------------------------------
drop policy if exists "storage_public_read_gallery" on storage.objects;
create policy "storage_public_read_gallery"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('gallery', 'lead-snapshots'));

-- ---------------------------------------------------------------------------
-- 3) POLITICAS: solo administradores pueden subir / actualizar / borrar
-- ---------------------------------------------------------------------------
drop policy if exists "storage_admin_insert" on storage.objects;
create policy "storage_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('gallery', 'lead-snapshots')
    and public.is_admin()
  );

drop policy if exists "storage_admin_update" on storage.objects;
create policy "storage_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id in ('gallery', 'lead-snapshots') and public.is_admin())
  with check (bucket_id in ('gallery', 'lead-snapshots') and public.is_admin());

drop policy if exists "storage_admin_delete" on storage.objects;
create policy "storage_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('gallery', 'lead-snapshots') and public.is_admin());

-- ---------------------------------------------------------------------------
-- 4) NOTA: el servidor (service_role) sube los recortes satelitales
--    creados por /api/map/snapshot y bypassa RLS automaticamente.
-- ---------------------------------------------------------------------------