import { DEFAULT_LOCALE, type Locale, LOCALES } from "./config";
import { es, type Dictionary } from "./es";
import { en } from "./en";

/**
 * Acceso a los diccionarios bilingues (Espanol / Ingles).
 * `en.ts` esta tipado con `Dictionary` derivado de `es.ts`, por lo que TypeScript
 * garantiza que ambos idiomas tengan exactamente las mismas claves.
 */

export const dictionaries: Record<Locale, Dictionary> = { es, en };

export function getDictionary(locale: Locale | string | null | undefined): Dictionary {
  return dictionaries[normalizeLocale(locale) satisfies Locale];
}

export function normalizeLocale(value: string | null | undefined): Locale {
  const candidate = (value ?? "").toLowerCase();
  return (LOCALES as readonly string[]).includes(candidate)
    ? (candidate as Locale)
    : DEFAULT_LOCALE;
}

/** Reemplaza marcadores tipo {current} en los textos del diccionario. */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export type { Dictionary, Locale };
export { DEFAULT_LOCALE, LOCALES };