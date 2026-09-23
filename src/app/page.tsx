import type { Metadata } from "next";

import { AboutSection } from "@/components/site/about-section";
import { ContactSection } from "@/components/site/contact-section";
import { FloatingContact } from "@/components/site/floating-contact";
import { GalleryCarousel } from "@/components/site/gallery-carousel";
import { Hero } from "@/components/site/hero";
import { PaymentsSection } from "@/components/site/payments-section";
import { QuoteCta } from "@/components/site/quote-cta";
import { ServicesSection } from "@/components/site/services-section";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/header";
import { BUSINESS, SERVICE_CITIES, SERVICE_ZIP_CODES } from "@/lib/constants";
import { fetchCarouselSlides } from "@/lib/gallery";
import { getDictionary } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { normalizeLocale } from "@/lib/i18n";
import { buildQrDataUrl } from "@/lib/qr";
import { cookies } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const t = getDictionary(locale);

  return {
    title: t.meta.title,
    description: t.meta.description,
    alternates: { canonical: "/" },
  };
}

/**
 * Pagina principal: hero, catalogo de servicios, galeria (carrusel),
 * invitacion al cotizador, empresa, metodos de pago y contacto.
 */
export default async function HomePage() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const t = getDictionary(locale);

  const [slides, cashAppQrDataUrl, venmoQrDataUrl] = await Promise.all([
    fetchCarouselSlides(),
    buildQrDataUrl(BUSINESS.cashAppUrl),
    buildQrDataUrl(BUSINESS.venmoUrl),
  ]);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LandscapingBusiness",
    name: BUSINESS.name,
    description: t.meta.description,
    telephone: BUSINESS.phoneE164,
    email: BUSINESS.email,
    slogan: t.hero.slogan,
    areaServed: SERVICE_CITIES.map((city) => ({ "@type": "City", name: `${city}, TX` })),
    address: {
      "@type": "PostalAddress",
      addressLocality: BUSINESS.city,
      addressRegion: BUSINESS.state,
      addressCountry: BUSINESS.country,
      postalCode: SERVICE_ZIP_CODES.slice(0, 1)[0],
    },
    openingHours: "Mo-Sa 07:00-19:00",
    priceRange: "$$",
    paymentAccepted: ["Cash", "Cash App", "Venmo", "Zelle"],
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Datos estructurados para buscadores (SEO local Austin, TX)
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteHeader />
      <main>
        <Hero />
        <ServicesSection />
        <GalleryCarousel items={slides} />
        <QuoteCta />
        <AboutSection />

        <PaymentsSection cashAppQrDataUrl={cashAppQrDataUrl} venmoQrDataUrl={venmoQrDataUrl} />

        <ContactSection />
      </main>
      <SiteFooter />
      <FloatingContact />
    </>
  );
}