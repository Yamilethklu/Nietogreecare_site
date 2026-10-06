import * as turf from "@turf/turf";
import { asAreaFeature, type AreaFeature } from "@/lib/parcel-geometry";

const MAX_ESTIMATED_HOUSE_AREA_SQ_M = 190;
const MIN_ESTIMATED_HOUSE_AREA_SQ_M = 35;

export function estimateHouseFootprint(parcel: AreaFeature): AreaFeature | null {
  try {
    const parcelArea = turf.area(parcel);
    if (!Number.isFinite(parcelArea) || parcelArea <= 0) return null;
    const targetArea = Math.min(
      parcelArea * 0.4,
      Math.max(
        MIN_ESTIMATED_HOUSE_AREA_SQ_M,
        Math.min(MAX_ESTIMATED_HOUSE_AREA_SQ_M, parcelArea * 0.28),
      ),
    );
    const center = turf.pointOnFeature(parcel).geometry.coordinates;
    const width = Math.sqrt(targetArea * 1.4);
    const depth = targetArea / width;
    const latitudeScale = Math.max(0.2, Math.cos((center[1] * Math.PI) / 180));
    const candidates = [
      [width, depth],
      [depth, width],
    ].map(([houseWidth, houseDepth]) => {
      const halfLng = houseWidth / (2 * 111_320 * latitudeScale);
      const halfLat = houseDepth / (2 * 111_320);
      const rectangle = turf.bboxPolygon([
        center[0] - halfLng,
        center[1] - halfLat,
        center[0] + halfLng,
        center[1] + halfLat,
      ]);
      return asAreaFeature(turf.intersect(turf.featureCollection([parcel, rectangle])));
    }).filter((candidate): candidate is AreaFeature => Boolean(candidate));

    return candidates
      .sort((left, right) => turf.area(right) - turf.area(left))
      .find((candidate) => turf.area(candidate) >= targetArea * 0.35) ?? null;
  } catch {
    return null;
  }
}
