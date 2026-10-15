"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [locale, setLocaleState] = React.useState<Locale>("en");

  React.useEffect(() => {
    applyLocaleToDocument("en");
  }, []);

  const setLocale = React.useCallback((next: Locale) => {
    applyLocaleToDocument("en");
    setLocaleState("en");
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(LOCALE_COOKIE, "en"); } catch { /* Cookies remain the source of truth when storage is blocked. */ }
    }
    router.refresh();
  }, [router]);

  const toggleLocale = React.useCallback(() => {
    setLocale("en");
  }, [locale, setLocale]);

  const value = React.useMemo<LanguageContextValue>(() => {
    const t = dictionaries.en;
    return {
      locale,
      isEs: false,
      t,
      setLocale,
      toggleLocale,
      tf: (template, values) =>
        Object.entries(values).reduce(
          (acc, [key, replacement]) => acc.replaceAll(`{${key}}`, String(replacement)),
          template,
        ),
      pick: (_spanish, english) => english,
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