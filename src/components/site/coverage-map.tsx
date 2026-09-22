"use client";

import * as React from "react";
import { ExternalLink, LoaderCircle, MapPin, Satellite } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { SERVICE_CITIES } from "@/lib/constants";
import { AUSTIN_CENTER, loadGoogleMaps } from "@/lib/google-maps";
import { cn } from "@/lib/utils";

/** Coordenadas oficiales de las ciudades donde opera Nieto Green Care LLC. */
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Austin: { lat: 30.2672, lng: -97.7431 },
  Hutto: { lat: 30.5427, lng: -97.5467 },
  "Round Rock": { lat: 30.5083, lng: -97.6789 },
  Georgetown: { lat: 30.6333, lng: -97.6779 },
  "Cedar Park": { lat: 30.5052, lng: -97.8203 },
};

/** Radio de cobertura operativa alrededor del area metropolitana de Austin. */
const COVERAGE_RADIUS_METERS = 42000;

type MapStatus = "loading" | "ready" | "fallback";

/**
 * Vista satelital del area de cobertura. Usa Google Maps Satellite (mapTypeId
 * "hybrid": imagen satelital + etiquetas) con un marcador por cada ciudad
 * atendida. Si la API no puede cargarse (clave restringida o sin conexion)
 * muestra el embed satelital sin clave, de modo que nunca queda un recuadro vacio.
 */
export function CoverageMap({ className }: { className?: string }) {
  const { isEs } = useLanguage();
  const [status, setStatus] = React.useState<MapStatus>("loading");
  const mapNode = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let disposed = false;
    let errorTimer: number | undefined;

    void loadGoogleMaps().then((available) => {
      if (disposed) return;
      if (!available || !window.google?.maps || !mapNode.current) {
        setStatus("fallback");
        return;
      }

      const g = window.google.maps;
      const map = new g.Map(mapNode.current, {
        center: AUSTIN_CENTER,
        zoom: 9,
        mapTypeId: "hybrid",
        backgroundColor: "#0B1120",
        gestureHandling: "cooperative",
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: g.MapTypeControlStyle.HORIZONTAL_BAR,
          position: g.ControlPosition.TOP_RIGHT,
          mapTypeIds: ["hybrid", "roadmap"],
        },
      });

      // Halo de cobertura sobre el corredor Austin - Hutto - Round Rock - Georgetown - Cedar Park.
      new g.Circle({
        map,
        center: AUSTIN_CENTER,
        radius: COVERAGE_RADIUS_METERS,
        fillColor: "#166534",
        fillOpacity: 0.18,
        strokeColor: "#C9A227",
        strokeOpacity: 0.55,
        strokeWeight: 1.5,
      });

      const bounds = new g.LatLngBounds();

      SERVICE_CITIES.forEach((city) => {
        const position = CITY_COORDINATES[city];
        if (!position) return;
        bounds.extend(position);

        const marker = new g.Marker({
          map,
          position,
          title: `${city}, TX`,
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: "#C9A227",
            fillOpacity: 1,
            strokeColor: "#090D16",
            strokeWeight: 2,
          },
        });

        const info = new g.InfoWindow({
          ariaLabel: `${city}, TX`,
          content: `<div style="font-family:system-ui,sans-serif;padding:2px 4px;"><p style="margin:0;font-size:13px;font-weight:700;color:#ffffff;">${city}, TX</p><p style="margin:4px 0 0;font-size:11px;color:#EBD79A;">Nieto Green Care LLC</p></div>`,
        });

        marker.addListener("click", () => info.open({ map, anchor: marker }));
      });

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { top: 46, right: 46, bottom: 46, left: 46 });
      }

      setStatus("ready");

      /* Si Google responde con error de clave o permisos, cae al embed satelital. */
      errorTimer = window.setTimeout(() => {
        if (!disposed && mapNode.current?.querySelector(".gm-err-container")) setStatus("fallback");
      }, 2600);
    });

    return () => {
      disposed = true;
      if (errorTimer) window.clearTimeout(errorTimer);
    };
  }, []);

  const embedSrc = `https://www.google.com/maps?q=${AUSTIN_CENTER.lat},${AUSTIN_CENTER.lng}&z=9&t=k&hl=${
    isEs ? "es" : "en"
  }&output=embed`;

  const openHref = `https://www.google.com/maps/place/Austin,+TX/@${AUSTIN_CENTER.lat},${AUSTIN_CENTER.lng},10z/data=!3m1!1e3`;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-gold-500/25 bg-ink-900/70 p-4 shadow-luxury backdrop-blur-md sm:p-5",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-ink-950">
        {/* Nodo del mapa: siempre montado (ocultarlo romperia el render de Google Maps). */}
        <div ref={mapNode} className="absolute inset-0" aria-hidden="true" />

        {status === "loading" ? (
          <div className="absolute inset-0 grid place-items-center bg-ink-950/80 text-center">
            <div className="flex flex-col items-center gap-2">
              <LoaderCircle className="size-7 animate-spin text-gold-300" />
              <p className="text-xs text-ink-300">
                {isEs ? "Cargando vista satelital…" : "Loading satellite view…"}
              </p>
            </div>
          </div>
        ) : null}

        {status === "fallback" ? (
          <>
            <iframe
              title={
                isEs ? "Mapa satelital del area de cobertura" : "Satellite map of the service area"
              }
              src={embedSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 size-full border-0"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-1.5 bg-gradient-to-t from-ink-950/95 via-ink-950/60 to-transparent p-3">
              {SERVICE_CITIES.map((city) => (
                <span
                  key={city}
                  className="rounded-full border border-gold-500/40 bg-ink-950/85 px-2.5 py-1 text-[11px] font-semibold text-gold-200"
                >
                  {city}
                </span>
              ))}
            </div>
          </>
        ) : null}

        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-ink-950/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-200">
          <Satellite className="size-3.5" />
          {isEs ? "Satélite" : "Satellite"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-300">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-gold-400" />
          {isEs
            ? "Cobertura activa en Austin, Hutto, Round Rock, Georgetown y Cedar Park."
            : "Active coverage across Austin, Hutto, Round Rock, Georgetown and Cedar Park."}
        </p>
        <a
          href={openHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-200 transition-colors hover:border-gold-400 hover:text-gold-100"
        >
          <ExternalLink className="size-3" />
          {isEs ? "Abrir mapa" : "Open map"}
        </a>
      </div>
    </div>
  );
}
