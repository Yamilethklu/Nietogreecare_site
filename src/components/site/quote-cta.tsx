"use client";

import { MessageSquare, Phone, Zap } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { LuxuryCard } from "@/components/ui/card";
import { buildWhatsAppHref, BUSINESS } from "@/lib/constants";

/** Bloque de conversión directa: conversación por WhatsApp o llamada inmediata. */
export function QuoteCta() {
  const { t, isEs } = useLanguage();

  const benefits = [
    isEs ? "Cuéntenos qué necesita" : "Tell us what you need",
    isEs ? "Comparta fotos si lo desea" : "Share photos if you wish",
    isEs ? "Reciba respuesta el mismo día" : "Get a same-day reply",
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
            eyebrow={isEs ? "Contacto directo" : "Direct contact"}
            title={isEs ? "Cotice por mensaje o llamada" : "Get a quote by message or phone"}
            subtitle={
              isEs
                ? "Sin formularios largos ni mapas: escriba directamente a nuestro equipo y cuéntenos sobre su proyecto."
                : "No long forms or maps: message our team directly and tell us about your project."
            }
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
              <a href={buildWhatsAppHref()} target="_blank" rel="noreferrer">
                <MessageSquare className="size-5" />
                {t.quoteCta.button}
              </a>
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