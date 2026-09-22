"use client";

import { MapPin, MessageSquare, Phone, Satellite } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { buildWhatsAppHref, BUSINESS, SERVICE_CITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const SATELLITE_EMBED_SRC =
  "https://www.google.com/maps?q=30.451,-97.68&z=10&t=k&output=embed";

/** Cobertura pública sin SDK de mapas ni controles que puedan bloquear los CTAs. */
export function CoverageMap({ className }: { className?: string }) {
  const { isEs } = useLanguage();

  return (
    <section
      aria-label={isEs ? "Área de cobertura" : "Service coverage"}
      className={cn(
        "overflow-hidden rounded-3xl border border-amber-400/35 bg-black/60 p-4 shadow-luxury backdrop-blur-sm sm:p-5",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/20 bg-ink-950">
        <iframe
          title={isEs ? "Vista satelital de la zona de cobertura" : "Satellite view of the service area"}
          src={SATELLITE_EMBED_SRC}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="pointer-events-none absolute inset-0 size-full border-0 saturate-[0.82] contrast-125"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400 backdrop-blur-sm">
          <Satellite className="size-3.5" />
          {isEs ? "Cobertura satelital" : "Satellite coverage"}
        </span>
        <p className="absolute inset-x-4 bottom-4 text-center text-xs font-medium leading-relaxed text-white drop-shadow">
          Austin · Hutto · Round Rock · Georgetown · Cedar Park
        </p>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {SERVICE_CITIES.map((city) => (
          <a
            key={city}
            href={buildWhatsAppHref(
              isEs
                ? `Hola, necesito servicio de paisajismo en ${city}.`
                : `Hello, I need landscaping service in ${city}.`,
            )}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/45 bg-black/55 px-3 py-2 text-xs font-semibold text-white transition hover:border-amber-400 hover:bg-black/75"
          >
            <MapPin className="size-3.5 text-amber-400" />
            {city}
          </a>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <a
          href={BUSINESS.telHref}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-black/50 px-4 py-3 text-sm font-semibold text-white transition hover:border-amber-400 hover:text-amber-400"
        >
          <Phone className="size-4 text-amber-400" />
          {isEs ? "Llamar ahora" : "Call now"}
        </a>
        <a
          href={buildWhatsAppHref()}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          <MessageSquare className="size-4" />
          {isEs ? "Enviar mensaje" : "Send a message"}
        </a>
      </div>
    </section>
  );
}