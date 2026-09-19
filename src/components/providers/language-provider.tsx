"use client";

import * as React from "react";

import { dictionaries } from "@/lib/i18n";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/es";

type LanguageContextValue = {
  locale: Locale;
  isEs: boolean;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  tf: (template: string, values: Record<string, string | number>) => string;
  pick: <T>(spanish: T, english: T) => T;
};

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

function applyLocaleToDocument(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Proveedor bilingue (Espanol / Ingles).
 * El idioma inicial llega desde el servidor (cookie), evitando desajustes de hidratacion.
 */
export function LanguageProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = React.useState<Locale>(initialLocale);

  React.useEffect(() => {
    applyLocaleToDocument(locale);
  }, [locale]);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_COOKIE, next);
    }
  }, []);

  const toggleLocale = React.useCallback(() => {
    setLocale(locale === "es" ? "en" : "es");
  }, [locale, setLocale]);

  const value = React.useMemo<LanguageContextValue>(() => {
    const t = dictionaries[locale];
    return {
      locale,
      isEs: locale === "es",
      t,
      setLocale,
      toggleLocale,
      tf: (template, values) =>
        Object.entries(values).reduce(
          (acc, [key, replacement]) => acc.replaceAll(`{${key}}`, String(replacement)),
          template,
        ),
      pick: (spanish, english) => (locale === "es" ? spanish : english),
    };
  }, [locale, setLocale, toggleLocale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage debe usarse dentro de <LanguageProvider>.");
  }
  return context;
}

/** Atajo para consumir solo el diccionario. */
export function useTranslation(): Dictionary {
  return useLanguage().t;
}