import * as turf from "@turf/turf";
import { gunzipSync } from "node:zlib";
import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";
import { asAreaFeature, type AreaFeature } from "@/lib/parcel-geometry";

type Parcel = Feature<Polygon | MultiPolygon, GeoJsonProperties>;
type DatasetTile = { location: string; quadKey: string; url: string };

const DATASET_LINKS_URL = "https://bfppub.blob.core.windows.net/%24web/2026-08-13/dataset-links.csv";
const MICROSOFT_HOSTS = new Set([
  "bfppub.blob.core.windows.net",
  "minedbuildings.blob.core.windows.net",
  "minedbuildings.z5.web.core.windows.net",
]);
let datasetTilesPromise: Promise<DatasetTile[] | null> | null = null;

function parseCsvRow(row: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"' && quoted && row[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function tileBounds(quadKey: string): [number, number, number, number] | null {
  let x = 0;
  let y = 0;
  for (let index = 0; index < quadKey.length; index += 1) {
    const digit = Number(quadKey[index]);
    const mask = 1 << (quadKey.length - index - 1);
    if (digit === 1 || digit === 3) x += mask;
    if (digit === 2 || digit === 3) y += mask;
    if (!Number.isInteger(digit) || digit < 0 || digit > 3) return null;
  }
  const scale = 2 ** quadKey.length;
  const longitude = (tileX: number) => (tileX / scale) * 360 - 180;
  const latitude = (tileY: number) => {
    const value = Math.PI - (2 * Math.PI * tileY) / scale;
    return (180 / Math.PI) * Math.atan(Math.sinh(value));
  };
  return [longitude(x), latitude(y + 1), longitude(x + 1), latitude(y)];
}

async function loadDatasetTiles(): Promise<DatasetTile[] | null> {
  const response = await fetch(DATASET_LINKS_URL, {
    cache: "force-cache",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const csv = await response.text();
  if (csv.length > 15_000_000) return null;
  const rows = csv.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvRow(rows.shift() ?? "").map((header) => header.trim().toLowerCase());
  const locationIndex = headers.indexOf("location");
  const quadKeyIndex = headers.indexOf("quadkey");
  const urlIndex = headers.indexOf("url");
  if (locationIndex < 0 || quadKeyIndex < 0 || urlIndex < 0) return null;

  return rows.flatMap((row) => {
    const columns = parseCsvRow(row);
    const location = columns[locationIndex]?.trim() ?? "";
    const quadKey = columns[quadKeyIndex]?.trim() ?? "";
    const url = columns[urlIndex]?.trim() ?? "";
    if (!/(united states|\busa\b|\bus\b|texas)/i.test(location) || !quadKey || !url) return [];
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" || !MICROSOFT_HOSTS.has(parsedUrl.hostname)) return [];
    return [{ location, quadKey, url: parsedUrl.toString() }];
  });
}

async function getDatasetTiles(): Promise<DatasetTile[] | null> {
  if (!datasetTilesPromise) {
    datasetTilesPromise = loadDatasetTiles().catch(() => null);
  }
  return datasetTilesPromise;
}

function parseBuildingRows(data: Uint8Array): unknown[] {
  const bytes = data[0] === 0x1f && data[1] === 0x8b
    ? gunzipSync(data, { maxOutputLength: 40_000_000 })
    : data;
  const text = new TextDecoder().decode(bytes);
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function getTileUrl(tile: DatasetTile): URL {
  const url = new URL(tile.url);
  if (!MICROSOFT_HOSTS.has(url.hostname) || url.protocol !== "https:") {
    throw new Error("invalid_dataset_url");
  }
  return url;
}

export async function getMicrosoftFootprint(parcel: Parcel): Promise<AreaFeature | null> {
  try {
    const tiles = await getDatasetTiles();
    if (!tiles) {
      console.warn("microsoft_footprint_dataset_unavailable");
      return null;
    }

    const matches = tiles.filter((tile) => {
      const bounds = tileBounds(tile.quadKey);
      if (!bounds) return false;
      try {
        return turf.booleanIntersects(parcel as AreaFeature, turf.bboxPolygon(bounds) as AreaFeature);
      } catch {
        return false;
      }
    });
    if (!matches.length) return null;
    if (matches.length > 12) {
      console.warn("microsoft_footprint_tile_limit_exceeded");
      return null;
    }

    const buildings: AreaFeature[] = [];
    for (const tile of matches) {
      const response = await fetch(getTileUrl(tile), {
        cache: "force-cache",
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) {
        console.warn("microsoft_footprint_tile_unavailable");
        continue;
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 5_000_000) {
        console.warn("microsoft_footprint_tile_too_large");
        continue;
      }
      for (const candidate of parseBuildingRows(new Uint8Array(buffer))) {
        const feature = asAreaFeature(candidate);
        if (!feature) continue;
        try {
          if (turf.booleanIntersects(feature, parcel as AreaFeature)) buildings.push(feature);
        } catch {
          continue;
        }
      }
    }
    if (!buildings.length) return null;

    const combined = buildings.length === 1
      ? buildings[0]
      : turf.union(turf.featureCollection(buildings) as any) as AreaFeature | null;
    if (!combined) return null;
    const clipped = asAreaFeature(turf.intersect(turf.featureCollection([combined, parcel as AreaFeature])));
    return clipped && turf.area(clipped) >= 10 ? clipped : null;
  } catch {
    console.warn("microsoft_footprint_lookup_failed");
    return null;
  }
}
