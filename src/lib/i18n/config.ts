/**
 * Configuracion bilingue del sitio (Espanol / Ingles).
 */

export type Locale = "es" | "en";

export const LOCALES = ["es", "en"] as const;

/** Espanol es el idioma por defecto de Nieto Green Care LLC. */
export const DEFAULT_LOCALE: Locale = "es";

export const LOCALE_COOKIE = "ngc_locale";

export const LOCALE_LABELS: Record<Locale, { short: string; long: string; flag: string }> = {
  es: { short: "ES", long: "Espanol", flag: "🇺🇸" },
  en: { short: "EN", long: "English", flag: "🇺🇸" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}