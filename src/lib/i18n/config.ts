/**
 * Configuracion bilingue del sitio (Espanol / Ingles).
 */

export type Locale = "es" | "en";

export const LOCALES = ["en"] as const;

/** English is the default language for Nieto Green Care LLC. */
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "ngc_locale";

export const LOCALE_LABELS: Record<Locale, { short: string; long: string; flag: string }> = {
  es: { short: "ES", long: "Español", flag: "🇲🇽" },
  en: { short: "EN", long: "English", flag: "🇺🇸" },
};

export function isLocale(value: unknown): value is Locale {
  return value === "en";
}