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
  const csvBytes = await readResponseBody(response, 15_000_000);
  if (!csvBytes) return null;
  const csv = new TextDecoder().decode(csvBytes);
  const rows = csv.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvRow(rows.shift() ?? "").map((header) => header.trim().replace(/^\uFEFF/, "").toLowerCase());
  const locationIndex = headers.indexOf("location");
  const quadKeyIndex = headers.indexOf("quadkey");
  const urlIndex = headers.indexOf("url");
  if (locationIndex < 0 || quadKeyIndex < 0 || urlIndex < 0) return null;

  return rows.flatMap((row) => {
    const columns = parseCsvRow(row);
    const location = columns[locationIndex]?.trim() ?? "";
    const quadKey = columns[quadKeyIndex]?.trim() ?? "";
    const url = columns[urlIndex]?.trim() ?? "";
    if (!/(united states|\busa\b|\bus\b|us-tx|texas)/i.test(location) || !quadKey || !url) return [];
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" || !MICROSOFT_HOSTS.has(parsedUrl.hostname)) return [];
    return [{ location, quadKey, url: parsedUrl.toString() }];
  });
}

async function getDatasetTiles(): Promise<DatasetTile[] | null> {
  if (!datasetTilesPromise) {
    const loading = loadDatasetTiles().catch(() => null);
    datasetTilesPromise = loading;
    void loading.then((tiles) => {
      if (!tiles && datasetTilesPromise === loading) datasetTilesPromise = null;
    });
  }
  return datasetTilesPromise;
}

async function readResponseBody(response: Response, limit: number): Promise<Uint8Array | null> {
  if (Number(response.headers.get("content-length")) > limit) return null;
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
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
    if (!matches.length) {
      console.warn("microsoft_footprint_no_matching_tiles");
      return null;
    }
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
      const buffer = await readResponseBody(response, 5_000_000);
      if (!buffer) {
        console.warn("microsoft_footprint_tile_too_large");
        continue;
      }
      for (const candidate of parseBuildingRows(buffer)) {
        const feature = asAreaFeature(candidate);
        if (!feature) continue;
        try {
          if (turf.booleanIntersects(feature, parcel as AreaFeature)) buildings.push(feature);
        } catch {
          continue;
        }
      }
    }
    if (!buildings.length) {
      console.warn("microsoft_footprint_no_building_found");
      return null;
    }

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
