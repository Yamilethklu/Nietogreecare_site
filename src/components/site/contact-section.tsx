"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, Mail, MapPin, MessageSquare, Phone } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { CallButton } from "@/components/site/brand";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BUSINESS, NEARBY_CITIES, SERVICE_CITIES } from "@/lib/constants";

/** Bloque de contacto con formulario simplificado "Enter Your Zip to Call or Text Us". */
export function ContactSection() {
  const { t, isEs } = useLanguage();
  const [zipInput, setZipInput] = React.useState("");

  const smsHrefWithZip = zipInput.trim()
    ? `sms:${BUSINESS.ownerSmsNumber}?body=${encodeURIComponent(`Hola Nieto Green Care LLC, mi Zip Code es ${zipInput}. Me gustaría solicitar servicio de césped.`)}`
    : `sms:${BUSINESS.ownerSmsNumber}?body=${encodeURIComponent("Hola Nieto Green Care LLC, me gustaría solicitar servicio de cuidado de césped.")}`;

  return (
    <section id="contacto" className="ngc-section scroll-mt-24">
      <div className="container flex flex-col gap-10">
        <SectionHeading
          eyebrow={t.contact.eyebrow}
          title={isEs ? "Contáctanos Directamente" : "Contact Us"}
          subtitle={
            isEs
              ? "Ingresa tu Zip Code para hablar directamente o enviar un mensaje por SMS."
              : "Enter Your Zip to Call or Text Us for fast lawn care quotes."
          }
        />

        {/* Formulario simplificado: Enter Your Zip to Call or Text Us */}
        <Card className="mx-auto w-full max-w-2xl border-emerald-500/30 bg-emerald-950/40 p-6 sm:p-8 backdrop-blur shadow-luxury">
          <div className="flex flex-col gap-5">
            <h3 className="text-xl font-bold text-white text-center">
              Enter Your Zip to Call or Text Us
            </h3>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  value={zipInput}
                  onChange={(e) => setZipInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder={isEs ? "Ej. 78701 (Zip Code)" : "Enter Zip Code (e.g. 78701)"}
                  maxLength={5}
                  className="h-12 text-center text-lg font-bold tracking-widest"
                />
              </div>

              <Button asChild variant="gold" size="lg" className="h-12 font-bold shrink-0">
                <a href={smsHrefWithZip}>
                  <MessageSquare className="mr-2 size-5" />
                  {isEs ? "ENVIAR TEXTO" : "TEXT US NOW"}
                </a>
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 pt-4">
              <Button asChild variant="outline" size="default">
                <a href={BUSINESS.telHref}>
                  <Phone className="mr-2 size-4 text-emerald-400" />
                  {BUSINESS.phoneDisplay}
                </a>
              </Button>

              <Button asChild variant="ghost" size="default">
                <Link href="/quote">
                  {isEs ? "Ir al Cotizador" : "Instant Quote"}
                </Link>
              </Button>
            </div>
          </div>
        </Card>

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
      </div>
    </section>
  );
}