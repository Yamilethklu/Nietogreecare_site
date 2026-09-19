"use client";

import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { CallButton } from "@/components/site/brand";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BUSINESS, NEARBY_CITIES, SERVICE_CITIES } from "@/lib/constants";

/** Bloque de contacto (telefono, correo, cobertura y horario). */
export function ContactSection() {
  const { t, isEs } = useLanguage();

  return (
    <section id="contacto" className="ngc-section scroll-mt-24">
      <div className="container flex flex-col gap-10">
        <SectionHeading
          eyebrow={t.contact.eyebrow}
          title={t.contact.title}
          subtitle={t.contact.subtitle}
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="flex flex-col gap-2 p-6">
            <Phone className="size-5 text-gold-300" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-400">{t.contact.phone}</p>
            <a
              href={BUSINESS.telHref}
              className="font-display text-lg font-semibold text-white transition-colors hover:text-gold-200"
            >
              {BUSINESS.phoneDisplay}
            </a>
          </Card>

          <Card className="flex flex-col gap-2 p-6">
            <Mail className="size-5 text-gold-300" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-400">
              {t.contact.email}
            </p>
            <a
              href={`mailto:${BUSINESS.email}`}
              className="break-all text-sm font-medium text-white transition-colors hover:text-gold-200"
            >
              {BUSINESS.email}
            </a>
          </Card>

          <Card className="flex flex-col gap-2 p-6">
            <MapPin className="size-5 text-gold-300" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-400">
              {t.contact.coverage}
            </p>
            <p className="text-sm font-medium text-white">
              {isEs ? BUSINESS.serviceAreaLabelEs : BUSINESS.serviceAreaLabel}
            </p>
            <p className="text-xs text-ink-400">
              {[...SERVICE_CITIES, ...NEARBY_CITIES].slice(0, 6).join(" · ")}
            </p>
          </Card>

          <Card className="flex flex-col gap-2 p-6">
            <Clock className="size-5 text-gold-300" />
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-400">{t.contact.hours}</p>
            <p className="text-sm font-medium text-white">
              {isEs ? BUSINESS.hoursEs : BUSINESS.hoursEn}
            </p>
            <p className="text-xs text-ink-400">
              {isEs ? "Domingos: cerrado" : "Sundays: closed"}
            </p>
          </Card>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <CallButton label={t.contact.ctaCall} size="lg" />
          <Button asChild variant="outline" size="lg">
            <a href={`mailto:${BUSINESS.email}`}>
              <Mail className="size-4" />
              {t.contact.ctaEmail}
            </a>
          </Button>
          <Button asChild variant="gold" size="lg">
            <Link href="/quote">{t.contact.ctaQuote}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}