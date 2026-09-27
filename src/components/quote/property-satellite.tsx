"use client";

import * as React from "react";
import { MapPin } from "lucide-react";

import type { GardenGeometry, PolygonPoint } from "@/lib/types";
import { loadGoogleMaps } from "@/lib/google-maps";

type Props = { address: string; latitude: number | null; longitude: number | null; isEs: boolean; compact?: boolean; geometry?: GardenGeometry; center?: PolygonPoint | null };

export function PropertySatellite({ address, latitude, longitude, isEs, compact = false, geometry, center }: Props) {
  const container = React.useRef<HTMLDivElement>(null);
  const overlays = React.useRef<any[]>([]);
  const [available, setAvailable] = React.useState(false);
  const [mapError, setMapError] = React.useState(false);
  const hasCoordinates = latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude);
  const lawnCenter = React.useMemo(() => getCenter(polygon), [polygon]);
  const lawnBounds = React.useMemo(() => getBounds(polygon), [polygon]);

  React.useEffect(() => {
    if (!hasCoordinates || !container.current) return;
    let cancelled = false;
    setAvailable(false);
    setMapError(false);
    void loadGoogleMaps().then((ready) => {
      if (cancelled) return;
      if (!ready || !container.current || !window.google?.maps) {
        setMapError(true);
        return;
      }
      const position = { lat: latitude!, lng: longitude! };
      const map = new window.google.maps.Map(container.current, {
        center: center ?? position,
        zoom: 19,
        mapTypeId: "satellite",
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: "cooperative",
      });
      if (geometry) {
        const components = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
        const bounds = new window.google.maps.LatLngBounds();
        components.forEach((component) => {
          const paths = component.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })));
          paths.flat().forEach((point) => bounds.extend(point));
          overlays.current.push(new window.google.maps.Polygon({
            map,
            paths,
            strokeColor: "#00FF00",
            strokeWeight: 2,
            fillColor: "#00FF00",
            fillOpacity: 0.35,
            clickable: false,
          }));
        });
        if (!bounds.isEmpty()) map.fitBounds(bounds);
      }
      overlays.current.push(new window.google.maps.Marker({
        map,
        position: center ?? position,
        title: address,
        icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
      }));
      setAvailable(true);
    });
    return () => {
      cancelled = true;
      overlays.current.forEach((overlay) => overlay.setMap(null));
      overlays.current = [];
    };
  }, [address, center, geometry, hasCoordinates, latitude, longitude]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 border-lime-400 bg-emerald-950 shadow-lg ${compact ? "min-h-56" : "min-h-72 sm:min-h-96"}`}>
      {!hasCoordinates && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white"><MapPin className="size-9 text-lime-400" /><p className="font-semibold">{isEs ? "Selecciona una dirección sugerida para ubicar el trabajo en el satélite." : "Select a suggested address to locate the job on satellite view."}</p></div>}
      {hasCoordinates && !available && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm font-semibold text-white">{mapError ? (isEs ? "No se pudo cargar Google Maps." : "Google Maps could not load.") : (isEs ? "Cargando mapa satelital interactivo…" : "Loading interactive satellite map…")}</div>}
      <div ref={container} className={`absolute inset-0 ${available ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-label={isEs ? "Mapa satelital de la propiedad" : "Property satellite map"} />
      {hasCoordinates && <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-slate-900 shadow"><MapPin className="size-4 shrink-0 text-green-600" /><span className="truncate">{address}</span></div>}
    </div>
  );
}
