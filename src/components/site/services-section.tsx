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
import { Badge } from "@/components/ui/badge";
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

/** Catalogo completo de servicios con precio base orientativo y acceso al cotizador. */
export function ServicesSection() {
  const { t, isEs } = useLanguage();

  return (
    <section id="servicios" className="ngc-section scroll-mt-24">
      <div className="container flex flex-col gap-12">
        <SectionHeading
          eyebrow={t.services.eyebrow}
          title={t.services.title}
          subtitle={t.services.subtitle}
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => {
            const Icon = SERVICE_ICONS[service.icon] ?? Leaf;
            return (
              <Card
                key={service.key}
                className={cn(
                  "group relative flex flex-col gap-4 overflow-hidden p-6 transition-all duration-500",
                  "hover:-translate-y-1 hover:border-gold-500/40 hover:shadow-gold",
                  service.featured && "border-gold-500/25 bg-ink-900/85",
                )}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-forest-600/20 blur-3xl transition-opacity duration-500 group-hover:bg-gold-500/20"
                />

                <span className="relative grid size-12 place-items-center rounded-xl border border-gold-500/30 bg-gradient-to-br from-forest-700 to-ink-950 shadow-inset">
                  <Icon className="size-6 text-gold-200" />
                </span>

                <div className="relative flex flex-1 flex-col gap-2">
                  <h3 className="font-display text-lg font-semibold leading-snug text-white">
                    {isEs ? service.nameEs : service.nameEn}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-200/75">
                    {isEs ? service.descriptionEs : service.descriptionEn}
                  </p>
                </div>

                <div className="relative flex items-center justify-between gap-3 border-t border-white/8 pt-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-300">
                    {t.services.included}
                  </span>
                  <Badge variant={service.featured ? "default" : "dark"}>
                    {isEs ? "Desde" : "From"} ${service.basePrice}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="gold" size="lg">
            <Link href="/quote">{t.services.ctaQuote}</Link>
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