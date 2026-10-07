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
    const parcelPolygons = parcel.geometry.type === "Polygon"
      ? [parcel.geometry.coordinates]
      : parcel.geometry.coordinates;
    const parcelEdges = parcelPolygons
      .map((polygon) => turf.lineString(polygon[0]))
      .filter((line) => line.geometry.coordinates.length >= 2);
    if (!parcelEdges.length) return turf.feature(lawn.geometry, lawn.properties) as AreaFeature;

    const parcelEdgePoint = parcelEdges
      .map((edge) => turf.nearestPointOnLine(edge, road, { units: "meters" }))
      .reduce((nearest, candidate) =>
        candidate.properties.dist < nearest.properties.dist ? candidate : nearest,
      );
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

    const housePolygons = house.geometry.type === "Polygon"
      ? [house.geometry.coordinates]
      : house.geometry.coordinates;
    const houseEdges = housePolygons
      .map((polygon) => turf.lineString(polygon[0]))
      .filter((line) => line.geometry.coordinates.length >= 2);
    if (!houseEdges.length) return turf.feature(lawn.geometry, lawn.properties) as AreaFeature;
    const houseEdgePoint = houseEdges
      .map((edge) => turf.nearestPointOnLine(edge, originPoint, { units: "meters" }))
      .reduce((nearest, candidate) =>
        candidate.properties.dist < nearest.properties.dist ? candidate : nearest,
      );

    const maxProjection = Math.max(...projections.map(({ forward }) => forward));
    const minProjection = Math.min(...projections.map(({ forward }) => forward));
    const houseProjection = project(houseEdgePoint.geometry.coordinates).forward;
    const distanceToHouse = maxProjection - houseProjection;
    if (!Number.isFinite(distanceToHouse) || distanceToHouse <= 0) {
      return turf.feature(lawn.geometry, lawn.properties) as AreaFeature;
    }
    const effectiveSetback = Math.min(setbackMeters, distanceToHouse * 0.8);
    const maxPerpendicular = Math.max(...projections.map(({ perpendicular }) => Math.abs(perpendicular)));
    const span = Math.max(maxProjection - minProjection, maxPerpendicular * 2, setbackMeters, 10);
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
