/**
 * Cargador unico de la Google Maps JavaScript API (Places, Drawing y Geometry).
 *
 * Centraliza la inyeccion del script para que todas las vistas que usan mapas
 * (inicio: mapa satelital de cobertura; /quote: medicion satelital y
 * autocompletado de direcciones) compartan la misma instancia de la API y
 * nunca se cargue dos veces.
 */

declare global {
  interface Window {
    google?: any;
    initNgcMaps?: () => void;
  }
}

/** Clave publica de Google Maps configurada fuera del repositorio. */
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** Centro del area metropolitana de Austin (base de los mapas y sesgos de busqueda). */
export const AUSTIN_CENTER = { lat: 30.2672, lng: -97.7431 } as const;

let loaderPromise: Promise<boolean> | null = null;

/**
 * Carga la API en el navegador una sola vez.
 * Devuelve `false` cuando el script no puede cargarse (clave restringida o sin
 * conexion) para que cada vista muestre su respaldo en lugar de un recuadro vacio.
 */
export function loadGoogleMaps(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!GOOGLE_MAPS_API_KEY) return Promise.resolve(false);
  if (window.google?.maps) return Promise.resolve(true);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-ngc-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.google?.maps)), {
        once: true,
      });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.ngcMaps = "true";
    script.async = true;
    window.initNgcMaps = () => resolve(Boolean(window.google?.maps));
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY,
    )}&libraries=places,drawing,geometry&callback=initNgcMaps`;
    script.onload = () => resolve(Boolean(window.google?.maps));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return loaderPromise;
}
