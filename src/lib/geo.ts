/**
 * Utilidades geograficas: areas, perimetros, polyline encoding y URLs de Static Maps.
 * El cliente usa la Geometry Library de Google (google.maps.geometry.spherical.computeArea)
 * y estas funciones sirven como fallback SSR / validacion en el servidor.
 */

import { COVERAGE_RADIUS_MILES, DEFAULT_DEPTH_INCHES } from "./constants";

const EARTH_RADIUS_METERS = 6378137;
const METERS_PER_MILE = 1609.344;
const METERS_TO_FEET = 3.280839895;
export const SQ_FT_PER_SQ_METER = 10.7639104;

export type LatLng = { lat: number; lng: number };

export const AUSTIN_CENTER: LatLng = { lat: 30.2672, lng: -97.7431 };

export const CITY_CENTERS: Record<string, LatLng> = {
  Austin: { lat: 30.2672, lng: -97.7431 },
  Hutto: { lat: 30.5427, lng: -97.5467 },
  "Round Rock": { lat: 30.5083, lng: -97.6789 },
  Georgetown: { lat: 30.6333, lng: -97.6772 },
  "Cedar Park": { lat: 30.5052, lng: -97.8203 },
  Pflugerville: { lat: 30.4394, lng: -97.62 },
  Leander: { lat: 30.5788, lng: -97.8531 },
  Manor: { lat: 30.3408, lng: -97.5569 },
  Lakeway: { lat: 30.3663, lng: -97.9797 },
  "Liberty Hill": { lat: 30.6649, lng: -97.9192 },
};

export const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function squareMetersToSquareFeet(squareMeters: number): number {
  return squareMeters * SQ_FT_PER_SQ_METER;
}

export function squareFeetToAcres(squareFeet: number): number {
  return squareFeet / 43560;
}

/** Yardas cuadradas (1 yd2 = 9 ft2). */
export function squareFeetToSquareYards(squareFeet: number): number {
  return squareFeet / 9;
}

/**
 * Estimacion de material en yardas cubicas:
 *   yd3 = (ft2 x profundidad_en_pulgadas) / 324
 */
export function cubicYardsFromArea(
  squareFeet: number,
  depthInches: number = DEFAULT_DEPTH_INCHES,
): number {
  if (!Number.isFinite(squareFeet) || squareFeet <= 0) return 0;
  const depth =
    Number.isFinite(depthInches) && depthInches > 0 ? depthInches : DEFAULT_DEPTH_INCHES;
  return (squareFeet * depth) / 324;
}

/** Distancia Haversine en millas entre dos puntos. */
export function distanceInMiles(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const haversine =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return (EARTH_RADIUS_METERS * c) / METERS_PER_MILE;
}

/** La coordenada cae dentro del radio de cobertura desde el centro de Austin? */
export function isWithinCoverageRadius(
  point: LatLng,
  center: LatLng = AUSTIN_CENTER,
  radiusMiles: number = COVERAGE_RADIUS_MILES,
): boolean {
  return distanceInMiles(point, center) <= radiusMiles;
}

/** Area esferica del poligono en m2 (equivalente a spherical.computeArea). */
export function polygonAreaSquareMeters(polygon: LatLng[]): number {
  if (!polygon || polygon.length < 3) return 0;
  const points = [...polygon, polygon[0]];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const lower = points[i];
    const middle = points[i + 1];
    total +=
      toRadians(middle.lng - lower.lng) *
      (2 + Math.sin(toRadians(lower.lat)) + Math.sin(toRadians(middle.lat)));
  }
  return Math.abs((total * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2);
}

/** Area del poligono en pies cuadrados. */
export function polygonAreaSquareFeet(polygon: LatLng[]): number {
  return squareMetersToSquareFeet(polygonAreaSquareMeters(polygon));
}

/** Perimetro del poligono en pies. */
export function polygonPerimeterFeet(polygon: LatLng[]): number {
  if (!polygon || polygon.length < 2) return 0;
  const points = [...polygon, polygon[0]];
  let meters = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const dLat = toRadians(points[i + 1].lat - points[i].lat);
    const dLng = toRadians(points[i + 1].lng - points[i].lng);
    const lat1 = toRadians(points[i].lat);
    const lat2 = toRadians(points[i + 1].lat);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    meters += 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  return meters * METERS_TO_FEET;
}

export type Bounds = { north: number; south: number; east: number; west: number };

export function getBounds(polygon: LatLng[]): Bounds | null {
  if (!polygon || polygon.length === 0) return null;
  return polygon.reduce<Bounds>(
    (acc, point) => ({
      north: Math.max(acc.north, point.lat),
      south: Math.min(acc.south, point.lat),
      east: Math.max(acc.east, point.lng),
      west: Math.min(acc.west, point.lng),
    }),
    { north: -90, south: 90, east: -180, west: 180 },
  );
}

export function getCentroid(polygon: LatLng[]): LatLng | null {
  if (!polygon || polygon.length === 0) return null;
  const sum = polygon.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / polygon.length, lng: sum.lng / polygon.length };
}

/** Codifica coordenadas al formato encoded polyline de Google Maps. */
export function encodePolyline(path: LatLng[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let result = "";

  const encodeValue = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let out = "";
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
    return out;
  };

  for (const point of path) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);
    result += encodeValue(lat - lastLat);
    result += encodeValue(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }

  return result;
}

export type StaticMapOptions = {
  center: LatLng;
  zoom: number;
  path?: LatLng[];
  size?: string;
  scale?: number;
  color?: string;
  fillColor?: string;
  markers?: LatLng[];
};

/** Construye la URL de Google Static Maps (maptype=satellite) con el poligono dibujado. */
export function buildStaticMapUrl(
  {
    center,
    zoom,
    path,
    size = "640x400",
    scale = 2,
    color = "0x166534ff",
    fillColor = "0x16653466",
    markers = [],
  }: StaticMapOptions,
  apiKey: string,
): string {
  const params = new URLSearchParams({
    center: `${center.lat},${center.lng}`,
    zoom: String(snapZoom(zoom)),
    size,
    scale: String(scale),
    maptype: "satellite",
    format: "png",
    key: apiKey,
  });

  if (path && path.length > 2) {
    params.append(
      "path",
      `color:${color}|weight:3|fillcolor:${fillColor}|enc:${encodePolyline(path)}`,
    );
  }

  markers.slice(0, 5).forEach((marker, index) => {
    params.append(
      "markers",
      `color:0x92400E|label:${String.fromCharCode(65 + index)}|${marker.lat},${marker.lng}`,
    );
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/** Ajusta el zoom al rango valido de la Static Maps API. */
export function snapZoom(zoom: number): number {
  return Math.max(1, Math.min(21, Math.round(zoom || 19)));
}

/** Convierte cualquier valor numerico seguro (numeric de Postgres llega como string). */
export function toNumberSafe(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

