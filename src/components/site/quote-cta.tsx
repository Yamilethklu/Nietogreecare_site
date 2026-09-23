"use client";

import Link from "next/link";
import { ClipboardList, Phone, Zap } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { LuxuryCard } from "@/components/ui/card";
import { BUSINESS } from "@/lib/constants";

/** Bloque de conversión hacia el cotizador interactivo oficial. */
export function QuoteCta() {
  const { t, isEs } = useLanguage();

  const benefits = [
    isEs ? "Ingrese su dirección y código postal" : "Enter your address and ZIP code",
    isEs ? "Mida o seleccione el tamaño de su terreno" : "Measure or choose your yard size",
    isEs ? "Elija servicios y complete su solicitud" : "Choose services and complete your request",
  ];

  return (
    <section id="cotizador" className="ngc-section scroll-mt-24">
      <div className="container">
        <LuxuryCard className="flex flex-col gap-8 p-7 sm:p-10">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-gold-500/15 blur-[100px]"
          />

          <SectionHeading
            eyebrow={t.quoteCta.eyebrow}
            title={t.quoteCta.title}
            subtitle={t.quoteCta.subtitle}
            align="left"
            className="relative"
          />

          <ul className="relative grid gap-3 sm:grid-cols-3">
            {benefits.map((benefit) => (
              <li
                key={benefit}
                className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/35 p-4 text-sm font-medium text-white"
              >
                <Zap className="size-4 shrink-0 text-amber-400" />
                {benefit}
              </li>
            ))}
          </ul>

          <div className="relative flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="gold" size="lg">
              <Link href="/quote">
                <ClipboardList className="size-5" />
                {t.quoteCta.button}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={BUSINESS.telHref}>
                <Phone className="size-5" />
                {isEs ? `Llamar ${BUSINESS.phoneDisplay}` : `Call ${BUSINESS.phoneDisplay}`}
              </a>
            </Button>
          </div>
        </LuxuryCard>
      </div>
    </section>
  );
}