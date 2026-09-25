import Link from "next/link";
import { Clock, Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";

import { FooterNote } from "@/components/site/footer-note";
import { SiteLogo } from "@/components/site/brand";
import { Badge } from "@/components/ui/badge";
import { BUSINESS, NEARBY_CITIES, SERVICE_CITIES } from "@/lib/constants";
import { getDictionary } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { cookies } from "next/headers";
import { normalizeLocale } from "@/lib/i18n";

/**
 * Pie de pagina del sitio (Server Component): traduce con la cookie de idioma
 * y deja el aviso de no-tarjeta de credito siempre visible.
 */
export async function SiteFooter() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const t = getDictionary(locale);
  const isEs = locale === "es";

  const quickLinks = [
    { href: "/#servicios", label: t.nav.services },
    { href: "/#galeria", label: t.nav.gallery },
    { href: "/#empresa", label: t.nav.about },
    { href: "/quote", label: t.nav.quote },
    { href: "/payments", label: t.nav.payments },
    { href: "/#contacto", label: t.nav.contact },
  ];

  return (
    <footer className="relative mt-8 border-t border-slate-200 bg-white">
      <div className="container grid gap-10 py-14 lg:grid-cols-4">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <SiteLogo size="md" />
          <p className="text-sm leading-relaxed text-slate-700/75">{t.footer.tagline}</p>
          <div className="flex items-center gap-2">
            <Badge variant="dark">{isEs ? "Empresa local" : "Local business"}</Badge>
            <Badge variant="forest">{isEs ? "Bilingue" : "Bilingual"}</Badge>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-200">
            {t.footer.quickLinks}
          </h3>
          <ul className="flex flex-col gap-2">
            {quickLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-slate-700/80 transition-colors hover:text-gold-200"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-200">
            {t.footer.serviceAreas}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {SERVICE_CITIES.map((city) => (
              <li key={city}>
                <Badge variant="forest">{city}</Badge>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-slate-500">
            {NEARBY_CITIES.join(" · ")}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-200">
            {t.footer.contactTitle}
          </h3>
          <ul className="flex flex-col gap-2 text-sm text-slate-700/80">
            <li>
              <a href={BUSINESS.telHref} className="flex items-center gap-2 hover:text-gold-200">
                <Phone className="size-4 text-gold-400" />
                {BUSINESS.phoneDisplay}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${BUSINESS.email}`}
                className="flex items-center gap-2 break-all hover:text-gold-200"
              >
                <Mail className="size-4 text-gold-400" />
                {BUSINESS.email}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gold-400" />
              {isEs ? BUSINESS.serviceAreaLabelEs : BUSINESS.serviceAreaLabel}
            </li>
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-gold-400" />
              {isEs ? BUSINESS.hoursEs : BUSINESS.hoursEn}
            </li>
          </ul>
          <div className="flex items-center gap-3 pt-1">
            <span className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-500">
              <Instagram className="size-4" />
            </span>
            <span className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-500">
              <Facebook className="size-4" />
            </span>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="ngc-gold-line" />
      </div>

      <FooterNote />
    </footer>
  );
}