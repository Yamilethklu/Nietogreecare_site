import { NextResponse } from "next/server";
import * as turf from "@turf/turf";

import { asAreaFeature, featureAreaSqFt, featureAreaSqM, featureCenter, findAreaFeature, subtractFootprint, type AreaFeature } from "@/lib/parcel-geometry";

export const runtime = "nodejs";

const GOOGLE_KEY = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const NO_PARCEL_ERROR = "No hay datos catastrales para esta dirección";
const LAWN_COMPUTE_ERROR = "No se pudo calcular el área del jardín";
const INVALID_LAWN_ERROR = "El área del jardín no es válida";
const APPROXIMATE_WARNING = "Aviso: la huella de la casa no está disponible, el área es aproximada";
const LAWN_DETECTION_UNAVAILABLE = "lawn_detection_unavailable";
const LAWN_DETECTION_FAILED = "lawn_detection_failed";
const GEOCODE_NOT_FOUND = "geocode_not_found";
const AREA_SELECTIONS = ["front_back", "front_only", "back_only"] as const;
type AreaSelection = (typeof AREA_SELECTIONS)[number];

function findBuildingFeature(payload: any): AreaFeature | null {
  const feature = payload?.features?.[0] ?? payload?.parcels?.features?.[0] ?? payload?.data?.features?.[0] ?? payload?.parcel ?? null;
  const properties = feature?.properties ?? feature?.parcel ?? feature ?? {};
  const candidates = [
    properties?.building_geometry,
    properties?.building?.geometry,
    properties?.buildings?.[0]?.geometry,
    properties?.structures?.[0]?.geometry,
    properties?.footprint,
    properties?.building_footprint,
    payload?.buildings?.features?.[0],
    payload?.building,
  ];
  return candidates.map(asAreaFeature).find((candidate): candidate is AreaFeature => Boolean(candidate)) ?? null;
}

async function getOverpassHouseFootprint(lat: number, lng: number): Promise<AreaFeature | null> {
  const query = `
    [out:json][timeout:25];
    (
      way["building"](around:60,${lat},${lng});
      relation["building"](around:60,${lat},${lng});
    );
    out geom;
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const point = turf.point([lng, lat]);
    const candidates = (Array.isArray(payload?.elements) ? payload.elements : []).flatMap((element: any) => {
      const vertices = Array.isArray(element?.geometry) ? element.geometry : [];
      if (vertices.length < 3) return [];
      const ring = vertices.map((vertex: any) => [Number(vertex.lon), Number(vertex.lat)]);
      if (ring.some((position: number[]) => !Number.isFinite(position[0]) || !Number.isFinite(position[1]))) return [];
      if (ring[0][0] !== ring.at(-1)?.[0] || ring[0][1] !== ring.at(-1)?.[1]) ring.push(ring[0]);
      try {
        return [turf.polygon([ring]) as AreaFeature];
      } catch {
        return [];
      }
    });
    const containing = candidates.find((feature: AreaFeature) => turf.booleanPointInPolygon(point, feature as any));
    return containing ?? candidates[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function simulatedHouseFootprint(lat: number, lng: number): AreaFeature {
  const sideMeters = Math.sqrt(1200 * 0.09290304);
  const latDelta = sideMeters / 111320;
  const lngDelta = sideMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  return turf.polygon([[
    [lng - lngDelta / 2, lat - latDelta / 2],
    [lng + lngDelta / 2, lat - latDelta / 2],
    [lng + lngDelta / 2, lat + latDelta / 2],
    [lng - lngDelta / 2, lat + latDelta / 2],
    [lng - lngDelta / 2, lat - latDelta / 2],
  ]]) as AreaFeature;
}

function selectMowArea(lawn: AreaFeature, parcel: AreaFeature, lat: number, lng: number, area: AreaSelection): AreaFeature | null {
  if (area === "front_back") return lawn;
  const [west, south, east, north] = turf.bbox(parcel as any);
  const width = Math.abs(east - west);
  const height = Math.abs(north - south);
  const parcelCenter = turf.center(parcel as any).geometry.coordinates;
  const splitLng = parcelCenter[0];
  const splitLat = parcelCenter[1];
  const useVerticalSplit = height >= width;
  const addressIsSouthOrWest = useVerticalSplit ? lat <= splitLat : lng <= splitLng;
  const frontIsLowerSide = addressIsSouthOrWest;
  const wantFront = area === "front_only";
  const useLowerSide = wantFront ? !frontIsLowerSide : frontIsLowerSide;
  const clipBox = useVerticalSplit
    ? useLowerSide
      ? [west, south, east, splitLat]
      : [west, splitLat, east, north]
    : useLowerSide
      ? [west, south, splitLng, north]
      : [splitLng, south, east, north];
  try {
    const clipped = turf.bboxClip(lawn as any, clipBox as any);
    const feature = asAreaFeature(clipped);
    if (!feature || featureAreaSqM(feature) <= 0) return lawn;
    return feature;
  } catch {
    return lawn;
  }
}

async function getSolarHouseFootprint(lat: number, lng: number, apiKey: string): Promise<AreaFeature | null> {
  if (!apiKey) return null;
  const url = new URL("https://solar.googleapis.com/v1/buildingInsights:findClosest");
  url.searchParams.set("location.latitude", String(lat));
  url.searchParams.set("location.longitude", String(lng));
  url.searchParams.set("requiredQuality", "HIGH");
  url.searchParams.set("key", apiKey);

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const segments = data?.solarPotential?.roofSegmentStats ?? [];
    const features = segments.flatMap((segment: any) => {
      const vertices = segment?.polygon?.vertices;
      if (!Array.isArray(vertices) || vertices.length < 3) return [];
      const ring = vertices.map((vertex: any) => [Number(vertex.longitude), Number(vertex.latitude)]);
      if (ring.some((position: number[]) => !Number.isFinite(position[0]) || !Number.isFinite(position[1]))) return [];
      if (ring[0][0] !== ring.at(-1)?.[0] || ring[0][1] !== ring.at(-1)?.[1]) ring.push(ring[0]);
      try {
        return [turf.polygon([ring])];
      } catch {
        return [];
      }
    });
    if (!features.length) return null;
    const combined = features.length === 1 ? features[0] : turf.union(turf.featureCollection(features));
    return combined ? (combined as AreaFeature) : null;
  } catch {
    return null;
  }
}

async function getWilliamsonParcel(latitude: number, longitude: number): Promise<{ parcel: AreaFeature; payload: unknown } | null> {
  const queryParcel = async (spatialRel: string) => {
    const parcelUrl = new URL("https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query");
    parcelUrl.searchParams.set("geometry", `${longitude},${latitude}`);
    parcelUrl.searchParams.set("geometryType", "esriGeometryPoint");
    parcelUrl.searchParams.set("inSR", "4326");
    parcelUrl.searchParams.set("spatialRel", spatialRel);
    parcelUrl.searchParams.set("outFields", "*");
    parcelUrl.searchParams.set("f", "geojson");

    const parcelResponse = await fetch(parcelUrl, { cache: "no-store" });
    if (!parcelResponse.ok) return null;
    const parcelPayload = await parcelResponse.json();
    const parcel = findAreaFeature(parcelPayload);
    return parcel ? { parcel, payload: parcelPayload } : null;
  };

  return (await queryParcel("esriSpatialRelWithin")) ?? queryParcel("esriSpatialRelIntersects");
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const address = params.get("address")?.trim() ?? "";
  const latParam = Number(params.get("lat"));
  const lngParam = Number(params.get("lng"));
  const requestedArea = params.get("area");
  const areaSelection: AreaSelection = AREA_SELECTIONS.includes(requestedArea as AreaSelection) ? requestedArea as AreaSelection : "front_back";

  if (!address && (!Number.isFinite(latParam) || !Number.isFinite(lngParam))) {
    return NextResponse.json({ ok: false, error: LAWN_DETECTION_UNAVAILABLE }, { status: 400 });
  }

  let latitude = latParam;
  let longitude = lngParam;
  let formattedAddress = address;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    if (!address || !GOOGLE_KEY) {
      return NextResponse.json({ ok: false, error: LAWN_DETECTION_UNAVAILABLE }, { status: 400 });
    }
    const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    geocodeUrl.searchParams.set("address", address);
    geocodeUrl.searchParams.set("key", GOOGLE_KEY);

    const geocodeResponse = await fetch(geocodeUrl, { cache: "no-store" });
    const geocode = await geocodeResponse.json();
    const result = geocode?.results?.[0];
    const location = result?.geometry?.location;

    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
      return NextResponse.json({ ok: false, error: GEOCODE_NOT_FOUND }, { status: 404 });
    }

    latitude = Number(location.lat);
    longitude = Number(location.lng);
    formattedAddress = String(result.formatted_address ?? address);
  }

  try {
    const parcelLookup = await getWilliamsonParcel(latitude, longitude);
    if (!parcelLookup) {
      return NextResponse.json({ ok: false, error: NO_PARCEL_ERROR, formattedAddress, latitude, longitude }, { status: 404 });
    }
    const { parcel, payload: parcelPayload } = parcelLookup;

    let house = findBuildingFeature(parcelPayload);
    let simulated = false;
    let warning: string | undefined;

    if (!house) {
      house = await getOverpassHouseFootprint(latitude, longitude);
    }

    if (!house) {
      house = await getSolarHouseFootprint(latitude, longitude, GOOGLE_KEY);
    }

    if (!house) {
      house = simulatedHouseFootprint(latitude, longitude);
      simulated = true;
      warning = APPROXIMATE_WARNING;
    }

    const fullLawn = subtractFootprint(parcel, house);
    const jardin = fullLawn ? selectMowArea(fullLawn, parcel, latitude, longitude, areaSelection) : null;
    if (!jardin?.geometry) {
      return NextResponse.json({ ok: false, error: LAWN_COMPUTE_ERROR, formattedAddress, latitude, longitude, warning }, { status: 422 });
    }

    const areaSqM = featureAreaSqM(jardin);
    if (!Number.isFinite(areaSqM) || areaSqM <= 0) {
      return NextResponse.json({ ok: false, error: INVALID_LAWN_ERROR, formattedAddress, latitude, longitude, warning }, { status: 422 });
    }

    const centro = featureCenter(jardin);

    return NextResponse.json({
      ok: true,
      poligonoParcela: parcel.geometry,
      poligonoJardin: jardin.geometry,
      areaMetros: areaSqM,
      areaPies: featureAreaSqFt(jardin),
      centro,
      huellaCasaSimulada: simulated,
      warning,
      formattedAddress,
      latitude,
      longitude,
    });
  } catch {
    return NextResponse.json({ ok: false, error: LAWN_DETECTION_FAILED, formattedAddress, latitude, longitude }, { status: 500 });
  }
}
