import * as turf from "@turf/turf";
import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";

const SQ_M_TO_SQ_FT = 10.7639;
const MAX_FRONTAGE_TRIM_RATIO = 0.8;

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

function nearestPointOnOuterRings(feature: AreaFeature, point: number[]) {
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
  const edges = polygons
    .map((polygon) => turf.lineString(polygon[0]))
    .filter((line) => line.geometry.coordinates.length >= 2);
  if (!edges.length) return null;
  return edges
    .map((edge) => turf.nearestPointOnLine(edge, turf.point(point), { units: "meters" }))
    .reduce((nearest, candidate) =>
      candidate.properties.dist < nearest.properties.dist ? candidate : nearest,
    );
}

export function subtractSidewalkStrip(
  lawn: AreaFeature,
  parcel: AreaFeature,
  house: AreaFeature,
  roadPoint: { lat: number; lng: number },
  setbackMeters: number,
): AreaFeature | null {
  try {
    if (!Number.isFinite(setbackMeters) || setbackMeters <= 0) {
      return turf.feature(lawn.geometry, lawn.properties) as AreaFeature;
    }

    const road = turf.point([roadPoint.lng, roadPoint.lat]);
    const parcelEdgePoint = nearestPointOnOuterRings(parcel, [roadPoint.lng, roadPoint.lat]);
    if (!parcelEdgePoint) return turf.feature(lawn.geometry, lawn.properties) as AreaFeature;
    const originPoint = turf.point(parcelEdgePoint.geometry.coordinates);
    const roadBearing = turf.bearing(originPoint, road);
    const project = (coordinate: number[]) => {
      const point = turf.point(coordinate);
      const distance = turf.distance(originPoint, point, { units: "meters" });
      const bearingOffset = ((turf.bearing(originPoint, point) - roadBearing + 540) % 360) - 180;
      const angle = (bearingOffset * Math.PI) / 180;
      return {
        forward: distance * Math.cos(angle),
        perpendicular: distance * Math.sin(angle),
      };
    };
    const projections = turf.coordAll(parcel as any)
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
      .map(project);
    if (!projections.length) return turf.feature(lawn.geometry, lawn.properties) as AreaFeature;

    const houseEdgePoint = nearestPointOnOuterRings(house, parcelEdgePoint.geometry.coordinates);
    if (!houseEdgePoint) return turf.feature(lawn.geometry, lawn.properties) as AreaFeature;

    const maxProjection = Math.max(...projections.map(({ forward }) => forward));
    const minProjection = Math.min(...projections.map(({ forward }) => forward));
    const houseProjection = project(houseEdgePoint.geometry.coordinates).forward;
    const distanceToHouse = -houseProjection;
    if (!Number.isFinite(distanceToHouse) || distanceToHouse <= 0) {
      return turf.feature(lawn.geometry, lawn.properties) as AreaFeature;
    }
    const effectiveSetback = Math.min(setbackMeters, distanceToHouse * MAX_FRONTAGE_TRIM_RATIO);
    const maxPerpendicular = Math.max(...projections.map(({ perpendicular }) => Math.abs(perpendicular)));
    const span = Math.max(maxProjection - minProjection, maxPerpendicular * 2, effectiveSetback, 10);
    const toCoordinate = (forward: number, perpendicular: number) => turf.destination(
      originPoint,
      Math.hypot(forward, perpendicular),
      roadBearing + (Math.atan2(perpendicular, forward) * 180) / Math.PI,
      { units: "meters" },
    ).geometry.coordinates;
    const cutoff = maxProjection - effectiveSetback;
    const halfWidth = maxPerpendicular + span;
    const sidewalkStrip = turf.polygon([[
      toCoordinate(cutoff, -halfWidth),
      toCoordinate(cutoff, halfWidth),
      toCoordinate(maxProjection + span, halfWidth),
      toCoordinate(maxProjection + span, -halfWidth),
      toCoordinate(cutoff, -halfWidth),
    ]]) as AreaFeature;

    return subtractFootprint(lawn, sidewalkStrip);
  } catch {
    return turf.feature(lawn.geometry, lawn.properties) as AreaFeature;
  }
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
