"use client";

import { MapPin, MessageSquare, Phone, Satellite } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { buildSmsHref, BUSINESS, SERVICE_CITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const SATELLITE_EMBED_SRC =
  "https://www.google.com/maps?q=30.65,-97.73&z=9&t=k&output=embed";

/** Cobertura pública sin SDK de mapas ni controles que puedan bloquear los CTAs. */
export function CoverageMap({ className }: { className?: string }) {
  const { isEs } = useLanguage();

  return (
    <section
      aria-label={isEs ? "Área de cobertura" : "Service coverage"}
      className={cn(
        "overflow-hidden rounded-3xl border border-amber-400/35 bg-white/60 p-4 shadow-luxury backdrop-blur-sm sm:p-5",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/20 bg-white">
        <iframe
          title={isEs ? "Vista satelital de la zona de cobertura" : "Satellite view of the service area"}
          src={SATELLITE_EMBED_SRC}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="pointer-events-none absolute inset-0 size-full border-0 saturate-[0.82] contrast-125"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-white/10" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400 backdrop-blur-sm">
          <Satellite className="size-3.5" />
          {isEs ? "Cobertura satelital" : "Satellite coverage"}
        </span>
        <p className="absolute inset-x-4 bottom-4 text-center text-xs font-medium leading-relaxed text-slate-900 drop-shadow">
          {SERVICE_CITIES.join(" · ")}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {SERVICE_CITIES.map((city) => (
          <a
            key={city}
            href={buildSmsHref()}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/45 bg-white/55 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:border-amber-400 hover:bg-white/75"
          >
            <MapPin className="size-3.5 text-amber-400" />
            {city}
          </a>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <a
          href={BUSINESS.telHref}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-amber-400 hover:text-amber-400"
        >
          <Phone className="size-4 text-amber-400" />
          {isEs ? "Llamar ahora" : "Call now"}
        </a>
        <a
          href={buildSmsHref()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-green-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-green-400"
        >
          <MessageSquare className="size-4" />
          {isEs ? "Enviar mensaje" : "Send a message"}
        </a>
      </div>
    </section>
  );
}
