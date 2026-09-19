import type { Metadata, Viewport } from "next";
import { Cinzel, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";

import { LanguageProvider } from "@/components/providers/language-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { BUSINESS } from "@/lib/constants";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { normalizeLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  fallback: ["Georgia", "serif"],
});

const cinzel = Cinzel({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["400", "600", "700"],
  fallback: ["Georgia", "serif"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  fallback: ["Inter", "system-ui", "sans-serif"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Nieto Green Care LLC | Paisajismo de lujo en Austin, TX",
    template: "%s | Nieto Green Care LLC",
  },
  description:
    "Paisajismo de lujo, corte de cesped, sod, fertilizacion y mantenimiento premium en Austin, Hutto, Round Rock, Georgetown y Cedar Park. Cotizacion interactiva con medicion satelital.",
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
    locale: "es_US",
    alternateLocale: ["en_US"],
    url: siteUrl,
    siteName: BUSINESS.name,
    title: "Nieto Green Care LLC | Paisajismo de lujo en Austin, TX",
    description:
      "Cotiza tu servicio de paisajismo en 5 pasos con medicion satelital. Austin, Hutto, Round Rock, Georgetown y Cedar Park.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nieto Green Care LLC",
    description: "Paisajismo de lujo y cuidado profesional de areas verdes en Austin, TX.",
  },
  robots: { index: true, follow: true },
  category: "Landscaping",
};

export const viewport: Viewport = {
  themeColor: "#090D16",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale: Locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <html lang={locale} className={cn(playfair.variable, cinzel.variable, jakarta.variable)}>
      <body className="min-h-dvh bg-ink-950 text-ink-50 antialiased">
        <LanguageProvider initialLocale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}