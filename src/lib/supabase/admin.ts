import { createClient } from "@supabase/supabase-js";

/**
 * Cliente administrativo con service_role: bypassa RLS.
 * SOLO debe importarse desde codigo de servidor (Route Handlers / Server Actions).
 */

export function hasSupabaseAdminEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getSupabaseAdminClient() {
  if (!hasSupabaseAdminEnv()) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "nieto-green-care-admin" } },
    },
  );
}

export const GALLERY_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_GALLERY_BUCKET || "gallery";
export const SNAPSHOT_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_SNAPSHOT_BUCKET || "lead-snapshots";

/** URL publica de un objeto almacenado en un bucket publico. */
export function publicStorageUrl(bucket: string, path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path.replace(/^\//, "")}`;
}