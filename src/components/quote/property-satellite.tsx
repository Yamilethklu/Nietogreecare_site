"use client";

import * as React from "react";
import { MapPin } from "lucide-react";

import { GOOGLE_MAPS_API_KEY, loadGoogleMaps } from "@/lib/google-maps";

type Props = { address: string; latitude: number | null; longitude: number | null; isEs: boolean; compact?: boolean };

export function PropertySatellite({ address, latitude, longitude, isEs, compact = false }: Props) {
  const container = React.useRef<HTMLDivElement>(null);
  const [available, setAvailable] = React.useState(false);
  const hasCoordinates = latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude);

  React.useEffect(() => {
    if (!hasCoordinates || !container.current) return;
    let cancelled = false;
    void loadGoogleMaps().then((ready) => {
      if (cancelled || !ready || !container.current || !window.google?.maps) return;
      const position = { lat: latitude!, lng: longitude! };
      const map = new window.google.maps.Map(container.current, {
        center: position,
        zoom: 19,
        mapTypeId: "satellite",
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: "cooperative",
      });
      new window.google.maps.Marker({ map, position, title: address, icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: "#65e918", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 3, scale: 11,
      } });
      setAvailable(true);
    });
    return () => { cancelled = true; };
  }, [address, hasCoordinates, latitude, longitude]);

  const staticUrl = hasCoordinates && GOOGLE_MAPS_API_KEY
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=19&size=640x420&scale=2&maptype=satellite&markers=color:0x65e918%7C${latitude},${longitude}&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`
    : null;

  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 border-lime-400 bg-emerald-950 shadow-lg ${compact ? "min-h-56" : "min-h-72 sm:min-h-96"}`}>
      {staticUrl && !available && <img src={staticUrl} alt={isEs ? "Vista satelital de la propiedad marcada" : "Satellite view of the marked property"} className="absolute inset-0 size-full object-cover" />}
      {!hasCoordinates && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white"><MapPin className="size-9 text-lime-400" /><p className="font-semibold">{isEs ? "Selecciona una dirección sugerida para ubicar el trabajo en el satélite." : "Select a suggested address to locate the job on satellite view."}</p></div>}
      <div ref={container} className={`absolute inset-0 ${available ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-label={isEs ? "Mapa satelital de la propiedad" : "Property satellite map"} />
      {hasCoordinates && <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-slate-900 shadow"><MapPin className="size-4 shrink-0 text-green-600" /><span className="truncate">{address}</span></div>}
    </div>
  );
}
