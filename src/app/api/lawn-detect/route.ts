import { NextResponse } from "next/server";
import * as turf from "@turf/turf";

import type { PolygonPoint } from "@/lib/types";

export const runtime = "nodejs";

type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type GeoJsonMultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

type GeoJsonGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

const GOOGLE_KEY = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const REGRID_TOKEN = process.env.REGRID_TOKEN || "";
const SQ_M_TO_SQ_FT = 10.7639;

function coordinatesToPath(ring: number[][]): PolygonPoint[] {
  return ring.map(([lng, lat]) => ({ lat, lng })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function geometryToPolygons(geometry: GeoJsonGeometry | null | undefined): PolygonPoint[][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [coordinatesToPath(geometry.coordinates[0] ?? [])].filter((path) => path.length >= 3);
  return geometry.coordinates.map((polygon) => coordinatesToPath(polygon[0] ?? [])).filter((path) => path.length >= 3);
}

function getGeometry(payload: any): GeoJsonGeometry | null {
  const candidates = [
    payload?.features?.[0]?.geometry,
    payload?.parcels?.features?.[0]?.geometry,
    payload?.results?.[0]?.geometry,
    payload?.data?.features?.[0]?.geometry,
  ];
  return candidates.find((geometry) => geometry?.type === "Polygon" || geometry?.type === "MultiPolygon") ?? null;
}

function getBuildingGeometry(payload: any): GeoJsonGeometry | null {
  const firstFeature = payload?.features?.[0] ?? payload?.parcels?.features?.[0] ?? payload?.results?.[0] ?? payload?.data?.features?.[0];
  const properties = firstFeature?.properties ?? firstFeature?.parcel ?? firstFeature ?? {};
  const candidates = [
    properties?.building_geometry,
    properties?.building?.geometry,
    properties?.buildings?.[0]?.geometry,
    properties?.structures?.[0]?.geometry,
    properties?.footprint,
    properties?.building_footprint,
    payload?.buildings?.features?.[0]?.geometry,
  ];
  return candidates.find((geometry) => geometry?.type === "Polygon" || geometry?.type === "MultiPolygon") ?? null;
}

function rectangleFootprint(latitude: number, longitude: number): GeoJsonPolygon {
  const feetPerLatitudeDegree = 364000;
  const feetToLat = (feet: number) => feet / feetPerLatitudeDegree;
  const feetToLng = (feet: number) => feet / (feetPerLatitudeDegree * Math.cos((latitude * Math.PI) / 180));
  const halfWidth = 32;
  const halfDepth = 42;
  const ring = [
    [longitude - feetToLng(halfWidth), latitude - feetToLat(halfDepth)],
    [longitude + feetToLng(halfWidth), latitude - feetToLat(halfDepth)],
    [longitude + feetToLng(halfWidth), latitude + feetToLat(halfDepth)],
    [longitude - feetToLng(halfWidth), latitude + feetToLat(halfDepth)],
    [longitude - feetToLng(halfWidth), latitude - feetToLat(halfDepth)],
  ];
  return { type: "Polygon", coordinates: [ring] };
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
    return NextResponse.json({ ok: false, error: "geocode_not_found" }, { status: 404 });
  }

  const latitude = Number(location.lat);
  const longitude = Number(location.lng);
  const formattedAddress = String(result.formatted_address ?? address);

  if (!REGRID_TOKEN) return NextResponse.json({ ok: false, error: "missing_regrid_token", formattedAddress, latitude, longitude }, { status: 500 });

  try {
    const regridUrl = new URL("https://app.regrid.com/api/v2/parcels");
    regridUrl.searchParams.set("lat", String(latitude));
    regridUrl.searchParams.set("lon", String(longitude));
    regridUrl.searchParams.set("token", REGRID_TOKEN);

    const regridResponse = await fetch(regridUrl, { cache: "no-store" });
    const regrid = await regridResponse.json();
    const parcelGeometry = getGeometry(regrid);
    const buildingGeometry = getBuildingGeometry(regrid);

    if (!parcelGeometry) return NextResponse.json({ ok: false, error: "parcel_not_found", formattedAddress, latitude, longitude }, { status: 404 });

    const parcel = turf.feature(parcelGeometry as any);
    const house = turf.feature((buildingGeometry ?? rectangleFootprint(latitude, longitude)) as any);
    const jardin = turf.difference(turf.featureCollection([parcel as any, house as any]) as any);
    if (!jardin?.geometry) return NextResponse.json({ ok: false, error: "lawn_difference_failed", formattedAddress, latitude, longitude }, { status: 422 });
    const geometry = jardin.geometry as GeoJsonGeometry;
    const areaSqM = turf.area(geometry as any);
    const polygons = geometryToPolygons(geometry);
    if (!polygons.length || areaSqM <= 0) return NextResponse.json({ ok: false, error: "lawn_area_empty", formattedAddress, latitude, longitude }, { status: 422 });

    return NextResponse.json({
      ok: true,
      source: buildingGeometry ? "regrid_minus_building" : "regrid_minus_placeholder_house",
      formattedAddress,
      latitude,
      longitude,
      hasBuildingFootprint: Boolean(buildingGeometry),
      polygons,
      areaSqM,
      areaSqFt: areaSqM * SQ_M_TO_SQ_FT,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "lawn_detection_failed", formattedAddress, latitude, longitude }, { status: 500 });
  }
}
