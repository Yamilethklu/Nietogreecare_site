"use client";

import * as React from "react";
import { MapPin } from "lucide-react";

import type { PolygonPoint } from "@/lib/types";
import { GOOGLE_MAPS_API_KEY, loadGoogleMaps } from "@/lib/google-maps";

type Props = { address: string; latitude: number | null; longitude: number | null; isEs: boolean; compact?: boolean; polygon?: PolygonPoint[][] };

function getOutline(paths?: PolygonPoint[][]): PolygonPoint[] | null {
  const points = paths?.flat().filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)) ?? [];
  if (points.length < 3) return null;
  const bounds = points.reduce(
    (acc, point) => ({
      north: Math.max(acc.north, point.lat),
      south: Math.min(acc.south, point.lat),
      east: Math.max(acc.east, point.lng),
      west: Math.min(acc.west, point.lng),
    }),
    { north: -90, south: 90, east: -180, west: 180 },
  );
  const latPad = Math.max((bounds.north - bounds.south) * 0.08, 0.00001);
  const lngPad = Math.max((bounds.east - bounds.west) * 0.08, 0.00001);
  return [
    { lat: bounds.south - latPad, lng: bounds.west - lngPad },
    { lat: bounds.south - latPad, lng: bounds.east + lngPad },
    { lat: bounds.north + latPad, lng: bounds.east + lngPad },
    { lat: bounds.north + latPad, lng: bounds.west - lngPad },
  ];
}

export function PropertySatellite({ address, latitude, longitude, isEs, compact = false, polygon }: Props) {
  const container = React.useRef<HTMLDivElement>(null);
  const [available, setAvailable] = React.useState(false);
  const hasCoordinates = latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude);
  const outline = React.useMemo(() => getOutline(polygon), [polygon]);

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
      if (outline?.length) new window.google.maps.Polygon({ map, paths:outline, strokeColor:"#93ef22", strokeWeight:4, fillColor:"#22c55e", fillOpacity:0.18, clickable:false });
      polygon?.forEach((path) => { if (path.length >= 3) new window.google.maps.Polygon({ map, paths:path, strokeColor:"#93ef22", strokeWeight:3, fillColor:"#5cd524", fillOpacity:0.38 }); });
      new window.google.maps.Marker({ map, position, icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png" });
      setAvailable(true);
    });
    return () => { cancelled = true; };
  }, [address, hasCoordinates, latitude, longitude, outline, polygon]);

  const staticUrl = hasCoordinates && GOOGLE_MAPS_API_KEY
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=19&size=640x420&scale=2&maptype=satellite&markers=color:red%7C${latitude},${longitude}&${outline?.length ? `path=fillcolor:0x22c55e2e%7Ccolor:0x93ef22ff%7Cweight:4%7C${outline.map((p) => `${p.lat},${p.lng}`).join("%7C")}%7C${outline[0].lat},${outline[0].lng}&` : ""}${polygon?.length ? polygon.map(path => `path=fillcolor:0x5cd52470%7Ccolor:0x93ef22ff%7Cweight:3%7C${path.map((p) => `${p.lat},${p.lng}`).join("%7C")}%7C${path[0].lat},${path[0].lng}&`).join("") : ""}key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`
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
