import type { Metadata } from "next";
import Link from "next/link";

import { PaymentsSection } from "@/components/site/payments-section";
import { Reviews } from "@/components/site/reviews";
import { GalleryCarousel } from "@/components/site/gallery-carousel";
import { Hero } from "@/components/site/hero";
import { SiteHeader } from "@/components/site/header";
import { BUSINESS, SERVICE_CITIES, SERVICE_ZIP_CODES } from "@/lib/constants";
import { fetchCarouselSlides } from "@/lib/gallery";
import { getDictionary } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { normalizeLocale } from "@/lib/i18n";
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
 * Portada y galería. Los demás contenidos se abren desde el menú.
 */
export default async function HomePage() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const t = getDictionary(locale);

  const slides = await fetchCarouselSlides();
  const grassPhoto = slides.find((slide) => /c[eé]sped|grass|lawn|yard/i.test(`${slide.title ?? ""} ${slide.description ?? ""}`) && !/\.(mp4|mov|webm)(?:$|[?#])/i.test(slide.url));

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
      <main className="bg-emerald-50 text-slate-900">
        <Hero backgroundUrl={grassPhoto?.url ?? "/hero-bg.jpg"} />
        <GalleryCarousel items={slides.length ? slides : [{ id: "lawn-photo", url: "/hero-bg.jpg", title: "Nieto Green Care LLC", description: null, location: null }]} />
        <Reviews />
        <PaymentsSection />
        <div className="container flex flex-wrap gap-5 border-t border-emerald-200 py-6 text-sm font-semibold text-emerald-900"><Link href="/admin">Acceso administradores</Link><Link href="/crew">Acceso trabajadores</Link></div>
      </main>
    </>
  );
}
