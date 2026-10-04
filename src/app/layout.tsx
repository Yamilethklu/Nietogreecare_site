import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

import { LanguageProvider } from "@/components/providers/language-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { FloatingContact } from "@/components/site/floating-contact";
import { BUSINESS } from "@/lib/constants";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { normalizeLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const isEs = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "es";
  return {
  metadataBase: new URL(siteUrl),
  title: {
    default: isEs ? "Nieto Green Care LLC | Paisajismo de lujo en Austin, TX" : "Nieto Green Care LLC | Luxury landscaping in Austin, TX",
    template: "%s | Nieto Green Care LLC",
  },
  description:
    isEs ? "Corte de césped y jardinería en Liberty Hill, Cedar Park, Leander, Georgetown, Hutto, Round Rock y Jarrell. Cotización de yarda en línea." : "Lawn mowing and landscaping in Liberty Hill, Cedar Park, Leander, Georgetown, Hutto, Round Rock and Jarrell. Get a lawn quote online.",
  keywords: [
    "landscaping Austin TX",
    "lawn care Austin",
    "paisajismo Austin",
    "corte de cesped Austin",
    "sod installation Austin",
    "Nieto Green Care",
    "Hutto",
    "Round Rock",
    "Georgetown",
    "Cedar Park",
  ],
  authors: [{ name: BUSINESS.name }],
  creator: BUSINESS.name,
  applicationName: BUSINESS.name,
  openGraph: {
    type: "website",
    locale: isEs ? "es_US" : "en_US",
    alternateLocale: [isEs ? "en_US" : "es_US"],
    url: siteUrl,
    siteName: BUSINESS.name,
    title: isEs ? "Nieto Green Care LLC | Paisajismo de lujo en Austin, TX" : "Nieto Green Care LLC | Luxury landscaping in Austin, TX",
    description:
      isEs ? "Cotiza tu corte de césped en cuatro pasos. Austin, Liberty Hill, Cedar Park, Leander, Georgetown, Hutto, Round Rock y Jarrell." : "Get your lawn mowing quote in four steps. Austin, Liberty Hill, Cedar Park, Leander, Georgetown, Hutto, Round Rock and Jarrell.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nieto Green Care LLC",
    description: isEs ? "Paisajismo de lujo y cuidado profesional de areas verdes en Austin, TX." : "Luxury landscaping and professional lawn care in Austin, TX.",
  },
  robots: { index: true, follow: true },
  category: "Landscaping",
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale: Locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <html lang={locale} className={cn("font-vars")}>
      <body className="min-h-dvh bg-white text-slate-900 antialiased">
        <LanguageProvider initialLocale={locale}>
          <ToastProvider>{children}<FloatingContact /></ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
