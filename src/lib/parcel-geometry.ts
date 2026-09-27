import * as turf from "@turf/turf";
import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";

const SQ_M_TO_SQ_FT = 10.7639;

export type AreaGeometry = Polygon | MultiPolygon;
export type AreaFeature = Feature<AreaGeometry, GeoJsonProperties>;

export function asAreaFeature(value: unknown): AreaFeature | null {
  const candidate = value as any;
  const geometry = (candidate?.type === "Feature" ? candidate.geometry : candidate?.geometry ?? candidate) as { type?: string; coordinates?: unknown } | null;
  if ((geometry?.type !== "Polygon" && geometry?.type !== "MultiPolygon") || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    return null;
  }
  return turf.feature(geometry as AreaGeometry) as AreaFeature;
}

export function findAreaFeature(payload: unknown): AreaFeature | null {
  const featureCollection = payload as {
    features?: unknown[];
    data?: { features?: unknown[] };
    parcels?: { features?: unknown[] } | unknown[];
    parcel?: unknown;
  } | null;
  const parcelFeatures = !featureCollection?.parcels || Array.isArray(featureCollection.parcels)
    ? []
    : (Array.isArray(featureCollection.parcels.features) ? featureCollection.parcels.features : []);
  const candidates = [
    ...(Array.isArray(featureCollection?.features) ? featureCollection.features : []),
    ...(Array.isArray(featureCollection?.data?.features) ? featureCollection.data.features : []),
    ...(Array.isArray(featureCollection?.parcels) ? featureCollection.parcels : []),
    ...parcelFeatures,
    featureCollection?.parcel,
    payload,
  ];
  return candidates.map(asAreaFeature).find((feature): feature is AreaFeature => Boolean(feature)) ?? null;
}

export function subtractFootprint(parcel: AreaFeature, building: AreaFeature | null): AreaFeature | null {
  if (!building) return turf.feature(parcel.geometry, parcel.properties) as AreaFeature;
  if (!turf.booleanIntersects(parcel as any, building as any)) {
    return turf.feature(parcel.geometry, parcel.properties) as AreaFeature;
  }
  const result = turf.difference(turf.featureCollection([parcel, building]) as any);
  return asAreaFeature(result);
}

export function featureAreaSqM(feature: AreaFeature): number {
  return turf.area(feature as any);
}

export function featureAreaSqFt(feature: AreaFeature): number {
  return featureAreaSqM(feature) * SQ_M_TO_SQ_FT;
}

export function featureCenter(feature: AreaFeature): { lat: number; lng: number } {
  const center = turf.center(feature as any);
  return {
    lat: center.geometry.coordinates[1],
    lng: center.geometry.coordinates[0],
  };
}
