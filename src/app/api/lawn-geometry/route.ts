import { NextResponse } from "next/server";
import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";

export const runtime = "nodejs";

type AreaGeometry = Polygon | MultiPolygon;
type AreaFeature = Feature<AreaGeometry>;

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

async function getHouseFootprint(lat: number, lng: number, apiKey: string): Promise<{ feature: AreaFeature; simulated: boolean; warning?: string }> {
  if (apiKey) {
    const url = new URL("https://solar.googleapis.com/v1/buildingInsights:findClosest");
    url.searchParams.set("location.latitude", String(lat));
    url.searchParams.set("location.longitude", String(lng));
    url.searchParams.set("requiredQuality", "HIGH");
    url.searchParams.set("key", apiKey);

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        const segments = payload?.solarPotential?.roofSegmentStats ?? [];
        const features = segments.flatMap((segment: any) => {
          const vertices = segment?.polygon?.vertices;
          if (!Array.isArray(vertices) || vertices.length < 3) return [];
          const ring = vertices.map((vertex: any) => [Number(vertex.longitude), Number(vertex.latitude)]);
          if (ring.some((position: number[]) => !Number.isFinite(position[0]) || !Number.isFinite(position[1]))) return [];
          if (ring[0][0] !== ring.at(-1)?.[0] || ring[0][1] !== ring.at(-1)?.[1]) ring.push(ring[0]);
          try { return [turf.polygon([ring])]; } catch { return []; }
        });
        if (features.length) {
          const combined = features.length === 1 ? features[0] : turf.union(turf.featureCollection(features));
          if (combined) return { feature: combined as AreaFeature, simulated: false };
        }
      }
    } catch {
      // Solar data can be unavailable for a property; report the fallback in the response.
    }
  }

  return { feature: simulatedHouseFootprint(lat, lng), simulated: true, warning: APPROXIMATE_WARNING };
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const address = typeof input?.address === "string" ? input.address.trim() : "";
  const zipCode = typeof input?.zipCode === "string" ? input.zipCode.trim() : "";
  if (address.length < 5) return NextResponse.json({ error: "Ingrese una dirección válida." }, { status: 400 });

  const googleKey = process.env.GOOGLE_MAPS_SERVER_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  if (!googleKey) return NextResponse.json({ error: "No está configurada la geocodificación de Google Maps." }, { status: 503 });

  const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  geocodeUrl.searchParams.set("address", [address, zipCode].filter(Boolean).join(", "));
  geocodeUrl.searchParams.set("key", googleKey);

  try {
    const geocodeResponse = await fetch(geocodeUrl, { cache: "no-store" });
    const geocode = await geocodeResponse.json();
    const location = geocode?.results?.[0]?.geometry?.location;
    if (!geocodeResponse.ok || geocode.status !== "OK" || !Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
      return NextResponse.json({ error: "Google Maps no pudo geocodificar esta dirección." }, { status: 422 });
    }

    const lat = Number(location.lat);
    const lng = Number(location.lng);
    const regridToken = process.env.REGRID_TOKEN ?? process.env.REGRID_API_TOKEN;
    if (!regridToken) {
      return NextResponse.json({ error: "No hay datos catastrales para esta dirección: falta configurar el token de Regrid." }, { status: 503 });
    }

    const parcelUrl = new URL("https://app.regrid.com/api/v2/parcels");
    parcelUrl.searchParams.set("lat", String(lat));
    parcelUrl.searchParams.set("lon", String(lng));
    parcelUrl.searchParams.set("token", regridToken);
    const parcelResponse = await fetch(parcelUrl, { cache: "no-store" });
    if (!parcelResponse.ok) return NextResponse.json({ error: NO_PARCEL_ERROR }, { status: 404 });
    const regridPayload = await parcelResponse.json();
    const parcel = findParcelFeature(regridPayload);
    if (!parcel) return NextResponse.json({ error: NO_PARCEL_ERROR }, { status: 404 });

    const regridHouse = findBuildingFeature(regridPayload);
    const house = regridHouse ? { feature: regridHouse, simulated: false } : await getHouseFootprint(lat, lng, googleKey);
    const jardin = turf.difference(turf.featureCollection([parcel, house.feature]));
    if (!jardin) return NextResponse.json({ error: LAWN_COMPUTE_ERROR, warning: house.warning }, { status: 422 });

    const areaMetros = turf.area(jardin);
    const areaPies = areaMetros * 10.7639;
    const centro = turf.center(jardin).geometry.coordinates;
    if (!Number.isFinite(areaMetros) || areaMetros <= 0) {
      return NextResponse.json({ error: LAWN_COMPUTE_ERROR, warning: house.warning }, { status: 422 });
    }

    return NextResponse.json({
      poligonoJardin: jardin.geometry,
      areaMetros,
      areaPies,
      centro: { lat: centro[1], lng: centro[0] },
      huellaCasaSimulada: house.simulated,
      warning: house.warning,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo obtener la geometría catastral de esta dirección." }, { status: 502 });
  }
}