import { NextResponse } from "next/server";
import * as turf from "@turf/turf";
import { solarMaskFootprint, SolarFootprintError } from "@/lib/solar-footprint";
import { selectLawnArea } from "@/lib/lawn-selection";
import { getCensusRoadPoint } from "@/lib/road-reference";
import { COUNTY_PARCEL_SERVICES, countyLookupOrder, extractLocality } from "@/lib/county-parcels";
import type { CountyName } from "@/lib/constants";

import { asAreaFeature, featureAreaSqFt, featureAreaSqM, featureCenter, findAreaFeature, subtractFootprint, type AreaFeature } from "@/lib/parcel-geometry";

export const runtime = "nodejs";

const GOOGLE_KEY = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const SOLAR_KEY = process.env.GOOGLE_SOLAR_API_KEY || process.env.SOLAR_API_KEY || GOOGLE_KEY;
const REGRID_TOKEN = process.env.REGRID_TOKEN || process.env.REGRID_API_TOKEN || process.env.NEXT_PUBLIC_REGRID_TOKEN || "";
const NO_PARCEL_ERROR = "No hay datos catastrales para esta dirección";
const LAWN_COMPUTE_ERROR = "No se pudo calcular el área del jardín";
const INVALID_LAWN_ERROR = "El área del jardín no es válida";
const LAWN_DETECTION_UNAVAILABLE = "lawn_detection_unavailable";
const LAWN_DETECTION_FAILED = "lawn_detection_failed";
const GEOCODE_NOT_FOUND = "geocode_not_found";
const SIDEWALK_SETBACK_METERS = 2.4;
const AREA_SELECTIONS = ["front_back", "front_only", "back_only"] as const;
type AreaSelection = (typeof AREA_SELECTIONS)[number];
type LatLngPoint = { lat: number; lng: number };

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

async function getOverpassHouseFootprint(lat: number, lng: number, parcel: AreaFeature): Promise<AreaFeature | null> {
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
    const inside = candidates.filter((feature: AreaFeature) => turf.booleanPointInPolygon(turf.pointOnFeature(feature), parcel));
    if (!inside.length) return null;
    const combined = inside.length === 1 ? inside[0] : turf.union(turf.featureCollection(inside));
    return combined ? asAreaFeature(turf.intersect(turf.featureCollection([parcel, combined]))) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getNearestRoadPoint(lat: number, lng: number, parcel: AreaFeature, address: string): Promise<LatLngPoint | null> {
  const censusRoad = await getCensusRoadPoint(lat, lng, parcel, address);
  if (censusRoad) return censusRoad;
  const query = `
    [out:json][timeout:25];
    way["highway"]["highway"!~"footway|path|cycleway|steps|track"](around:140,${lat},${lng});
    out geom;
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

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
    const parcelCenter = turf.center(parcel as any);
    let nearest: { point: LatLngPoint; distance: number; matches: boolean } | null = null;
    const normalize = (value:string) => value.toLowerCase().replace(/\b(street|st|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|avenue|ave|way|circle|cir)\b/g,"").replace(/[^a-z0-9]/g,"");
    const street = normalize(address.split(",")[0].replace(/^\d+\s*/,""));

    for (const element of Array.isArray(payload?.elements) ? payload.elements : []) {
      const vertices = Array.isArray(element?.geometry) ? element.geometry : [];
      if (vertices.length < 2) continue;
      const coordinates = vertices.map((vertex: any) => [Number(vertex.lon), Number(vertex.lat)]);
      if (coordinates.some((position: number[]) => !Number.isFinite(position[0]) || !Number.isFinite(position[1]))) continue;
      const road = turf.lineString(coordinates);
      const closest = turf.nearestPointOnLine(road, parcelCenter, { units: "meters" });
      const distance = Number(closest.properties?.dist);
      if (!Number.isFinite(distance)) continue;
      const candidate = {
        point: { lat: closest.geometry.coordinates[1], lng: closest.geometry.coordinates[0] },
        distance,
        matches: Boolean(element.tags?.name && street && normalize(element.tags.name) === street),
      };
      if (!nearest || (candidate.matches && !nearest.matches) || (candidate.matches === nearest.matches && candidate.distance < nearest.distance)) nearest = candidate;
    }

    return nearest?.point ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function excludeSidewalkStrip(lawn: AreaFeature, parcel: AreaFeature, house: AreaFeature, roadPoint: LatLngPoint | null): AreaFeature {
  if (!roadPoint) return lawn;
  try {
    const [west, south, east, north] = turf.bbox(parcel as any);
    const width = Math.abs(east - west);
    const height = Math.abs(north - south);
    const span = Math.max(width, height) * 4;
    const houseCenter = turf.center(house as any).geometry.coordinates;
    const vectorLng = roadPoint.lng - houseCenter[0];
    const vectorLat = roadPoint.lat - houseCenter[1];
    const vectorLength = Math.hypot(vectorLng, vectorLat);
    if (vectorLength <= 0) return lawn;

    const unitLng = vectorLng / vectorLength;
    const unitLat = vectorLat / vectorLength;
    const sideLng = -unitLat * span;
    const sideLat = unitLng * span;
    const directionLng = unitLng * span;
    const directionLat = unitLat * span;
    const bearing = turf.bearing(turf.point(houseCenter), turf.point([roadPoint.lng, roadPoint.lat]));
    const setbackPoint = turf.destination(turf.point(houseCenter), SIDEWALK_SETBACK_METERS, bearing, { units: "meters" }).geometry.coordinates;
    const setbackProjection = Math.abs((setbackPoint[0] - houseCenter[0]) * unitLng + (setbackPoint[1] - houseCenter[1]) * unitLat);
    if (!Number.isFinite(setbackProjection) || setbackProjection <= 0) return lawn;

    const parcelCoordinates = turf.coordAll(parcel as any);
    const frontProjection = Math.max(
      ...parcelCoordinates
        .filter((position) => Number.isFinite(position[0]) && Number.isFinite(position[1]))
        .map((position) => (position[0] - houseCenter[0]) * unitLng + (position[1] - houseCenter[1]) * unitLat),
    );
    if (!Number.isFinite(frontProjection)) return lawn;

    const stripProjection = frontProjection - setbackProjection;
    const stripLng = houseCenter[0] + unitLng * stripProjection;
    const stripLat = houseCenter[1] + unitLat * stripProjection;
    const sideA = [stripLng + sideLng, stripLat + sideLat];
    const sideB = [stripLng - sideLng, stripLat - sideLat];
    const sidewalkStrip = turf.polygon([[
      sideA,
      sideB,
      [sideB[0] + directionLng, sideB[1] + directionLat],
      [sideA[0] + directionLng, sideA[1] + directionLat],
      sideA,
    ]]) as AreaFeature;
    return subtractFootprint(lawn, sidewalkStrip) ?? lawn;
  } catch {
    return lawn;
  }
}

async function getCountyParcel(county: CountyName, latitude: number, longitude: number): Promise<{ parcel: AreaFeature; payload: unknown } | null> {
  const endpoint = COUNTY_PARCEL_SERVICES[county];
  if (!endpoint) return null;
  const queryParcel = async (spatialRel: string) => {
    const parcelUrl = new URL(endpoint);
    parcelUrl.searchParams.set("geometry", `${longitude},${latitude}`);
    parcelUrl.searchParams.set("geometryType", "esriGeometryPoint");
    parcelUrl.searchParams.set("inSR", "4326");
    parcelUrl.searchParams.set("outSR", "4326");
    parcelUrl.searchParams.set("spatialRel", spatialRel);
    parcelUrl.searchParams.set("outFields", "*");
    parcelUrl.searchParams.set("f", "geojson");

    const parcelResponse = await fetch(parcelUrl, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!parcelResponse.ok) return null;
    const parcelPayload = await parcelResponse.json();
    const parcel = findAreaFeature(parcelPayload);
    return parcel && turf.booleanPointInPolygon(turf.point([longitude,latitude]),parcel) ? { parcel, payload: parcelPayload } : null;
  };

  return (await queryParcel("esriSpatialRelWithin")) ?? queryParcel("esriSpatialRelIntersects");
}

async function getLocality(latitude: number, longitude: number) {
  if (!GOOGLE_KEY) return extractLocality(undefined);
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${latitude},${longitude}`);
    url.searchParams.set("key", GOOGLE_KEY);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    const payload = await response.json();
    const result = payload?.results?.find((item: any) => item?.address_components?.some((c: any) => c?.types?.includes("administrative_area_level_2"))) ?? payload?.results?.[0];
    return extractLocality(result?.address_components);
  } catch {
    return extractLocality(undefined);
  }
}

async function getRegridParcel(latitude: number, longitude: number): Promise<{ parcel: AreaFeature; payload: unknown } | null> {
  if (!REGRID_TOKEN) return null;

  const parcelUrl = new URL("https://app.regrid.com/api/v2/parcels/point");
  parcelUrl.searchParams.set("lat", String(latitude));
  parcelUrl.searchParams.set("lon", String(longitude));
  parcelUrl.searchParams.set("token", REGRID_TOKEN);

  const parcelResponse = await fetch(parcelUrl, { cache: "no-store", signal: AbortSignal.timeout(7000) });
  if (!parcelResponse.ok) return null;

  const parcelPayload = await parcelResponse.json();
  const parcel = findAreaFeature(parcelPayload);
  return parcel && turf.booleanPointInPolygon(turf.point([longitude,latitude]),parcel) ? { parcel, payload: parcelPayload } : null;
}

async function getParcelGeometry(latitude: number, longitude: number, locality: ReturnType<typeof extractLocality>): Promise<{ parcel: AreaFeature; payload: unknown } | null> {
  for (const county of countyLookupOrder(locality)) {
    const found = await getCountyParcel(county, latitude, longitude).catch(() => null);
    if (found) return found;
  }
  return getRegridParcel(latitude, longitude).catch(()=>null);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const address = params.get("address")?.trim() ?? "";
  const latParam = params.has("lat") ? Number(params.get("lat")) : NaN;
  const lngParam = params.has("lng") ? Number(params.get("lng")) : NaN;
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
    const locality = await getLocality(latitude, longitude);
    const parcelLookup = await getParcelGeometry(latitude, longitude, locality);
    if (!parcelLookup) {
      return NextResponse.json({ ok: false, error: NO_PARCEL_ERROR, formattedAddress, latitude, longitude }, { status: 404 });
    }
    const { parcel, payload: parcelPayload } = parcelLookup;

    let house = findBuildingFeature(parcelPayload);
    let simulated = false;
    let warning: string | undefined;

    if (!house) {
      house = await getOverpassHouseFootprint(latitude, longitude, parcel);
    }

    let footprintError = "building_footprint_unavailable";
    if (!house) {
      try {
        house = await solarMaskFootprint(latitude, longitude, SOLAR_KEY, parcel);
      } catch (error) {
        if (!(error instanceof SolarFootprintError)) throw error;
        footprintError = error.code;
        console.warn("lawn_detection", error.code);
      }
    }

    if (!house) {
      return NextResponse.json({ok:false,error:footprintError,poligonoParcela:parcel.geometry,formattedAddress,latitude,longitude},{status:422});
    }

    const houseFootprint = house;
    const fullLawn = subtractFootprint(parcel, houseFootprint);
    const roadPoint = await getNearestRoadPoint(latitude, longitude, parcel, formattedAddress);
    const mowableLawn = fullLawn ? excludeSidewalkStrip(fullLawn, parcel, houseFootprint, roadPoint) : null;
    const jardin = mowableLawn ? selectLawnArea(mowableLawn, houseFootprint, roadPoint, areaSelection) : null;
    warning = roadPoint ? "sidewalk_estimate" : "sidewalk_not_excluded";
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
