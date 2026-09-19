import { getSupabaseAdminClient } from "./supabase/admin";
import { MAX_CAROUSEL_SLIDES } from "./constants";

/**
 * Lectura de la galeria publicada (Server Component).
 * Si Supabase no esta configurado o la consulta falla, se devuelve una lista
 * vacia para que la pagina principal muestre su estado elegante por defecto.
 */
export type GallerySlide = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  location: string | null;
};

type GalleryRow = {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  public_url: string | null;
};

export async function fetchCarouselSlides(
  limit: number = MAX_CAROUSEL_SLIDES,
): Promise<GallerySlide[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("gallery")
      .select("id, title, description, location, public_url, carousel_order, created_at")
      .eq("is_published", true)
      .eq("is_carousel", true)
      .order("carousel_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return (data as GalleryRow[])
      .filter((row) => Boolean(row.public_url))
      .map((row) => ({
        id: row.id,
        url: row.public_url as string,
        title: row.title,
        description: row.description,
        location: row.location,
      }));
  } catch {
    return [];
  }
}