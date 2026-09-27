import { NextResponse } from "next/server";
import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";

export const runtime = "nodejs";

type AreaGeometry = Polygon | MultiPolygon;
type AreaFeature = Feature<AreaGeometry>;

const GOOGLE_KEY = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const REGRID_TOKEN = process.env.REGRID_TOKEN || process.env.REGRID_API_TOKEN || "";
const SQ_M_TO_SQ_FT = 10.7639;
const NO_PARCEL_ERROR = "No hay datos catastrales para esta dirección";
const LAWN_COMPUTE_ERROR = "No se pudo calcular el área del jardín";
const INVALID_LAWN_ERROR = "El área del jardín no es válida";
const APPROXIMATE_WARNING = "Aviso: la huella de la casa no está disponible, el área es aproximada";

function asFeature(value: any): AreaFeature | null {
  const geometry = value?.type === "Feature" ? value.geometry : value?.geometry ?? value;
  if ((geometry?.type !== "Polygon" && geometry?.type !== "MultiPolygon") || !geometry.coordinates?.length) return null;
  return turf.feature(geometry) as AreaFeature;
}

function findParcelFeature(payload: any): AreaFeature | null {
  const candidates = [
    ...(Array.isArray(payload?.features) ? payload.features : []),
    ...(Array.isArray(payload?.parcels?.features) ? payload.parcels.features : []),
    ...(Array.isArray(payload?.data?.features) ? payload.data.features : []),
    ...(Array.isArray(payload?.parcels) ? payload.parcels : []),
  ];
  return candidates.map(asFeature).find((feature): feature is AreaFeature => Boolean(feature)) ?? asFeature(payload?.parcel);
}

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
  return candidates.map(asFeature).find((candidate): candidate is AreaFeature => Boolean(candidate)) ?? null;
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

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const address = params.get("address")?.trim() ?? "";

  if (!address || !GOOGLE_KEY) {
    return NextResponse.json({ ok: false, error: "missing_address_or_google_key" }, { status: 400 });
  }

  const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  geocodeUrl.searchParams.set("address", address);
  geocodeUrl.searchParams.set("key", GOOGLE_KEY);

  const geocodeResponse = await fetch(geocodeUrl, { cache: "no-store" });
  const geocode = await geocodeResponse.json();
  const result = geocode?.results?.[0];
  const location = result?.geometry?.location;

  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return NextResponse.json({ ok: false, error: "Google Maps no pudo geocodificar esta dirección." }, { status: 404 });
  }

  const latitude = Number(location.lat);
  const longitude = Number(location.lng);
  const formattedAddress = String(result.formatted_address ?? address);

  if (!REGRID_TOKEN) {
    return NextResponse.json({ ok: false, error: LAWN_COMPUTE_ERROR, formattedAddress, latitude, longitude }, { status: 500 });
  }

  try {
    const regridUrl = new URL("https://app.regrid.com/api/v2/parcels");
    regridUrl.searchParams.set("lat", String(latitude));
    regridUrl.searchParams.set("lon", String(longitude));
    regridUrl.searchParams.set("token", REGRID_TOKEN);

    const regridResponse = await fetch(regridUrl, { cache: "no-store" });
    if (!regridResponse.ok) {
      return NextResponse.json({ ok: false, error: NO_PARCEL_ERROR, formattedAddress, latitude, longitude }, { status: 404 });
    }

    const regrid = await regridResponse.json();
    const parcel = findParcelFeature(regrid);
    if (!parcel) {
      return NextResponse.json({ ok: false, error: NO_PARCEL_ERROR, formattedAddress, latitude, longitude }, { status: 404 });
    }

    let house = findBuildingFeature(regrid);
    let simulated = false;
    let warning: string | undefined;

    if (!house) {
      house = await getSolarHouseFootprint(latitude, longitude, GOOGLE_KEY);
      if (!house) {
        house = simulatedHouseFootprint(latitude, longitude);
        simulated = true;
        warning = APPROXIMATE_WARNING;
      }
    }

    const jardin = turf.difference(turf.featureCollection([parcel, house]) as any);
    if (!jardin?.geometry) {
      return NextResponse.json({ ok: false, error: LAWN_COMPUTE_ERROR, formattedAddress, latitude, longitude, warning }, { status: 422 });
    }

    const areaSqM = turf.area(jardin as any);
    if (!Number.isFinite(areaSqM) || areaSqM <= 0) {
      return NextResponse.json({ ok: false, error: INVALID_LAWN_ERROR, formattedAddress, latitude, longitude, warning }, { status: 422 });
    }

    const centroPoint = turf.center(jardin as any);
    const centro = {
      lat: centroPoint.geometry.coordinates[1],
      lng: centroPoint.geometry.coordinates[0],
    };

    return NextResponse.json({
      ok: true,
      poligonoJardin: jardin.geometry,
      areaMetros: areaSqM,
      areaPies: areaSqM * SQ_M_TO_SQ_FT,
      centro,
      huellaCasaSimulada: simulated,
      warning,
      formattedAddress,
      latitude,
      longitude,
    });
  } catch {
    return NextResponse.json({ ok: false, error: LAWN_COMPUTE_ERROR, formattedAddress, latitude, longitude }, { status: 500 });
  }
}
