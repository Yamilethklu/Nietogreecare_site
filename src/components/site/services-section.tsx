"use client";

import Link from "next/link";
import {
  CalendarCheck,
  Droplets,
  Layers,
  Leaf,
  Mountain,
  Phone,
  Scissors,
  Sprout,
  TreePine,
  Trees,
  Wind,
  type LucideIcon,
} from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BUSINESS, SERVICES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Mapa de iconos lucide declarados en constants.SERVICES. */
const SERVICE_ICONS: Record<string, LucideIcon> = {
  Scissors,
  TreePine,
  Sprout,
  Leaf,
  Layers,
  Trees,
  Wind,
  Droplets,
  Mountain,
  CalendarCheck,
};

/** Catálogo oficial de servicios, sin precios públicos. */
export function ServicesSection() {
  const { t, isEs } = useLanguage();

  return (
    <section id="servicios" className="ngc-section scroll-mt-24">
      <div className="container flex flex-col gap-9">
        <SectionHeading
          eyebrow={t.services.eyebrow}
          title={t.services.title}
          subtitle={t.services.subtitle}
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SERVICES.map((service) => {
            const Icon = SERVICE_ICONS[service.icon] ?? Leaf;
            return (
              <Card
                key={service.key}
                className={cn(
                  "group relative flex min-h-[190px] flex-col gap-3 overflow-hidden p-4 transition-all duration-500 sm:p-5",
                  "hover:-translate-y-1 hover:border-gold-500/40 hover:shadow-gold",
                  service.featured && "border-emerald-200 bg-white",
                )}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-12 -top-12 size-28 rounded-full bg-forest-600/20 blur-3xl transition-opacity duration-500 group-hover:bg-gold-500/20"
                />

                <span className="relative grid size-10 place-items-center rounded-lg border border-gold-500/30 bg-gradient-to-br from-forest-700 to-slate-50 shadow-inset">
                  <Icon className="size-5 text-gold-200" />
                </span>

                <div className="relative flex flex-1 flex-col gap-2">
                  <h3 className="font-display text-base font-semibold leading-snug text-slate-900 sm:text-lg">
                    {isEs ? service.nameEs : service.nameEn}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-700/80 sm:text-sm">
                    {isEs ? service.descriptionEs : service.descriptionEn}
                  </p>
                </div>

                <div className="relative border-t border-white/8 pt-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gold-300">
                    {t.services.included}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="gold" size="lg">
            <Link href="/quote">
              {t.services.ctaQuote}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={BUSINESS.telHref} aria-label={`${t.services.ctaCall} ${BUSINESS.phoneDisplay}`}>
              <Phone className="size-4" />
              {t.services.ctaCall}
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
