"use client";

import * as React from "react";
import { MapPin } from "lucide-react";

import type { LawnGeoJsonGeometry, PolygonPoint } from "@/lib/types";
import { GOOGLE_MAPS_API_KEY, loadGoogleMaps } from "@/lib/google-maps";

type Props = {
  address: string;
  latitude: number | null;
  longitude: number | null;
  isEs: boolean;
  compact?: boolean;
  polygon?: PolygonPoint[][];
  parcelPolygons?: PolygonPoint[][];
  geometry?: LawnGeoJsonGeometry;
  center?: PolygonPoint | null;
  loadingText?: string;
  showMarker?: boolean;
};

function getBounds(paths?: PolygonPoint[][]) {
  const points = paths?.flat().filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)) ?? [];
  if (points.length < 3) return null;
  return points.reduce(
    (acc, point) => ({
      north: Math.max(acc.north, point.lat),
      south: Math.min(acc.south, point.lat),
      east: Math.max(acc.east, point.lng),
      west: Math.min(acc.west, point.lng),
    }),
    { north: -90, south: 90, east: -180, west: 180 },
  );
}

function getCenter(paths?: PolygonPoint[][]): PolygonPoint | null {
  const points = paths?.flat().filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)) ?? [];
  if (!points.length) return null;
  return {
    lat: points.reduce((total, point) => total + point.lat, 0) / points.length,
    lng: points.reduce((total, point) => total + point.lng, 0) / points.length,
  };
}

function ringToPath(ring: number[][]): PolygonPoint[] {
  return ring
    .map(([lng, lat]) => ({ lat, lng }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function geometryToGooglePaths(geometry?: LawnGeoJsonGeometry): PolygonPoint[][][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates.map(ringToPath).filter((ring) => ring.length >= 3)];
  return geometry.coordinates.map((polygon) => polygon.map(ringToPath).filter((ring) => ring.length >= 3)).filter((polygon) => polygon.length > 0);
}

export function PropertySatellite({ address, latitude, longitude, isEs, compact = false, polygon, parcelPolygons, geometry, center, loadingText, showMarker = true }: Props) {
  const container = React.useRef<HTMLDivElement>(null);
  const [available, setAvailable] = React.useState(false);
  const hasCoordinates = latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude);
  const googlePaths = React.useMemo(() => geometryToGooglePaths(geometry), [geometry]);
  const parcelPaths = React.useMemo(() => parcelPolygons?.map((path) => [path]).filter((paths) => paths[0]?.length >= 3) ?? [], [parcelPolygons]);
  const fallbackPaths = React.useMemo(() => polygon?.map((path) => [path]) ?? [], [polygon]);
  const mapPaths = googlePaths.length ? googlePaths : fallbackPaths;
  const flatPaths = React.useMemo(() => mapPaths.flat(), [mapPaths]);
  const allFlatPaths = React.useMemo(() => [...parcelPaths.flat(), ...flatPaths], [parcelPaths, flatPaths]);
  const lawnCenter = React.useMemo(() => center ?? getCenter(flatPaths) ?? getCenter(allFlatPaths), [center, flatPaths, allFlatPaths]);
  const lawnBounds = React.useMemo(() => getBounds(allFlatPaths), [allFlatPaths]);

  React.useEffect(() => {
    if (!hasCoordinates || !container.current) return;
    let cancelled = false;
    setAvailable(false);
    void loadGoogleMaps().then((ready) => {
      if (cancelled || !ready || !container.current || !window.google?.maps) return;
      const position = { lat: latitude!, lng: longitude! };
      const map = new window.google.maps.Map(container.current, {
        center: lawnCenter ?? position,
        zoom: 19,
        mapTypeId: "satellite",
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: "cooperative",
      });
      parcelPaths.forEach((paths) => {
        if (paths[0]?.length >= 3) {
          new window.google.maps.Polygon({
            map,
            paths,
            strokeColor: "#22c55e",
            strokeOpacity: 0.95,
            strokeWeight: 3,
            fillColor: "#22c55e",
            fillOpacity: 0,
            clickable: false,
          });
        }
      });
      mapPaths.forEach((paths) => {
        if (paths[0]?.length >= 3) {
          new window.google.maps.Polygon({
            map,
            paths,
            strokeColor: "#14532d",
            strokeOpacity: 0.95,
            strokeWeight: 2,
            fillColor: "#14532d",
            fillOpacity: 0.45,
            clickable: false,
          });
        }
      });
      if (lawnBounds) {
        const bounds = new window.google.maps.LatLngBounds(
          { lat: lawnBounds.south, lng: lawnBounds.west },
          { lat: lawnBounds.north, lng: lawnBounds.east },
        );
        map.fitBounds(bounds, 48);
      }
      if (showMarker) {
        new window.google.maps.Marker({
          map,
          position,
          icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        });
      }
      setAvailable(true);
    });
    return () => { cancelled = true; };
  }, [address, hasCoordinates, latitude, longitude, lawnBounds, lawnCenter, mapPaths, parcelPaths, showMarker]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 border-lime-400 bg-emerald-950 shadow-lg ${compact ? "min-h-56" : "min-h-72 sm:min-h-96"}`}>
      {!hasCoordinates && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white"><MapPin className="size-9 text-lime-400" /><p className="font-semibold">{isEs ? "Selecciona una dirección sugerida para ubicar el trabajo en el satélite." : "Select a suggested address to locate the job on satellite view."}</p></div>}
      {hasCoordinates && !available && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm font-semibold text-white">{GOOGLE_MAPS_API_KEY ? (loadingText ?? (isEs ? "Cargando mapa satelital..." : "Loading satellite map...")) : (isEs ? "Falta configurar NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en Vercel para mostrar el mapa satelital." : "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing in Vercel for the satellite map.")}</div>}
      <div ref={container} className={`absolute inset-0 ${available ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-label={isEs ? "Mapa satelital de la propiedad" : "Property satellite map"} />
      {hasCoordinates && <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-slate-900 shadow"><MapPin className="size-4 shrink-0 text-green-600" /><span className="truncate">{address}</span></div>}
    </div>
  );
}
