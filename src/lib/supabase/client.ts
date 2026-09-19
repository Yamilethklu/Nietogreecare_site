import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el navegador (componentes "use client").
 * Se crea de forma perezosa: si faltan las variables de entorno el sitio sigue
 * funcionando en modo demostracion en lugar de romper el render.
 */

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function hasSupabaseBrowserEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseBrowserClient() {
  if (!hasSupabaseBrowserEnv()) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    );
  }
  return browserClient;
}