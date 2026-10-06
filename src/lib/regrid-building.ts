import * as turf from "@turf/turf";
import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";
import { asAreaFeature, type AreaFeature } from "@/lib/parcel-geometry";

type Parcel = Feature<Polygon | MultiPolygon, GeoJsonProperties>;

const REGRID_TOKEN =
  process.env.REGRID_TOKEN ||
  process.env.REGRID_API_TOKEN ||
  process.env.NEXT_PUBLIC_REGRID_TOKEN ||
  "";

function collectBuildingFeatures(payload: unknown): AreaFeature[] {
  const found: AreaFeature[] = [];
  const visited = new Set<object>();
  const visit = (value: unknown, depth: number, buildingContext: boolean) => {
    if (depth > 6 || found.length >= 100 || !value || typeof value !== "object") return;
    if (visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1, buildingContext));
      return;
    }

    const record = value as Record<string, unknown>;
    if (buildingContext) {
      const feature = asAreaFeature(record);
      if (feature) found.push(feature);
    }
    for (const [key, child] of Object.entries(record)) {
      if (/(building|structure|footprint)/i.test(key)) {
        visit(child, depth + 1, true);
      } else if (buildingContext && key === "geometry") {
        const feature = asAreaFeature(child);
        if (feature) found.push(feature);
      } else if (depth < 2 && typeof child === "object") {
        visit(child, depth + 1, false);
      }
    }
  };
  visit(payload, 0, false);
  return found;
}

export async function getRegridBuilding(parcel: Parcel): Promise<AreaFeature | null> {
  if (!REGRID_TOKEN) return null;
  try {
    const center = turf.center(parcel);
    const [longitude, latitude] = center.geometry.coordinates;
    const url = new URL("https://app.regrid.com/api/v2/parcels/point");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("token", REGRID_TOKEN);
    url.searchParams.set("return_matched_buildings", "true");
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      console.warn("regrid_building_lookup_unavailable");
      return null;
    }

    const payload = await response.json();
    const buildings = collectBuildingFeatures(payload).filter((building) => {
      try {
        return turf.booleanIntersects(building, parcel);
      } catch {
        return false;
      }
    });
    if (!buildings.length) return null;
    const combined = buildings.length === 1
      ? buildings[0]
      : turf.union(turf.featureCollection(buildings) as any) as AreaFeature | null;
    if (!combined) return null;
    const clipped = asAreaFeature(turf.intersect(turf.featureCollection([combined, parcel])));
    return clipped && turf.area(clipped) >= 10 ? clipped : null;
  } catch {
    console.warn("regrid_building_lookup_failed");
    return null;
  }
}
